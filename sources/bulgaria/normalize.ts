import type { NormalizedZone, Restriction, ZoneGeometry } from '../../shared/zone';
import messagesEn from './messages.en.json' with { type: 'json' };

const SOURCE_ID = 'bulgaria';
const TRANSLATIONS = messagesEn as Record<string, string>;

const RESTRICTIONS: Record<string, Restriction> = {
  PROHIBITED: 'PROHIBITED',
  REQ_AUTHORISATION: 'REQ_AUTHORISATION',
  CONDITIONAL: 'CONDITIONAL',
};

const EARTH_R = 6_371_008.8;

function circleBbox(
  center: [number, number],
  radiusM: number,
): [number, number, number, number] {
  const [lon, lat] = center;
  const dLat = (radiusM / EARTH_R) * (180 / Math.PI);
  const dLon = dLat / Math.max(Math.cos((lat * Math.PI) / 180), 1e-6);
  return [lon - dLon, lat - dLat, lon + dLon, lat + dLat];
}

function ringsBbox(rings: [number, number][][]): [number, number, number, number] {
  let minLon = 180;
  let minLat = 90;
  let maxLon = -180;
  let maxLat = -90;
  for (const ring of rings) {
    for (const [lon, lat] of ring) {
      if (lon < minLon) minLon = lon;
      if (lon > maxLon) maxLon = lon;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }
  }
  return [minLon, minLat, maxLon, maxLat];
}

/**
 * The authority states required notice inside the free-text message rather than in a
 * dedicated field, e.g. "5 работни дни преди планираната дата" or "1 месец".
 */
function noticeDaysFrom(message: string | null): number | undefined {
  if (!message) return undefined;
  if (/месец/i.test(message)) return 30;
  const m = message.match(/(\d+)\s*(?:работни|раб\.?)?\s*дни/i);
  return m ? Number(m[1]) : undefined;
}

function translate(source: string | null): Record<string, string> {
  if (!source) return {};
  const en = TRANSLATIONS[source];
  return en ? { en } : {};
}

export function normalize(raw: string): { zones: NormalizedZone[]; warnings: string[] } {
  const warnings: string[] = [];
  const doc = JSON.parse(raw);
  if (!Array.isArray(doc?.features)) {
    throw new Error('unexpected payload: no features array');
  }

  const zones: NormalizedZone[] = [];
  for (const f of doc.features) {
    const id = `BGR-${f.identifier}`;

    const restriction = RESTRICTIONS[String(f.restriction ?? '').toUpperCase()];
    if (!restriction) {
      warnings.push(`${id}: unknown restriction "${f.restriction}"`);
      continue;
    }

    const g = f.geometry?.[0];
    if (!g?.horizontalProjection) {
      warnings.push(`${id}: missing geometry`);
      continue;
    }
    if (f.geometry.length > 1) {
      warnings.push(`${id}: ${f.geometry.length} geometries present, only the first is used`);
    }

    const hp = g.horizontalProjection;
    let geometry: ZoneGeometry;
    let bbox: [number, number, number, number];
    if (hp.type === 'Circle') {
      const center: [number, number] = [hp.center[0], hp.center[1]];
      geometry = { kind: 'circle', center, radiusM: hp.radius };
      bbox = circleBbox(center, hp.radius);
    } else if (hp.type === 'Polygon') {
      const rings = hp.coordinates as [number, number][][];
      geometry = { kind: 'polygon', rings };
      bbox = ringsBbox(rings);
    } else {
      warnings.push(`${id}: unsupported geometry type "${hp.type}"`);
      continue;
    }

    if (g.uomDimensions !== 'M') {
      warnings.push(`${id}: vertical unit "${g.uomDimensions}" is not metres`);
    }
    if (g.upperVerticalReference !== g.lowerVerticalReference) {
      warnings.push(
        `${id}: mixed vertical references (${g.lowerVerticalReference}/${g.upperVerticalReference})`,
      );
    }
    const reference = g.upperVerticalReference === 'AMSL' ? 'AMSL' : 'AGL';

    const app = f.applicability?.[0] ?? { permanent: 'YES' };
    const applicability =
      String(app.permanent).toUpperCase() === 'YES'
        ? ({ permanent: true } as const)
        : ({ permanent: false, start: app.startDateTime, end: app.endDateTime } as const);

    const auth = f.zoneAuthority?.[0] ?? {};
    // Trailing whitespace varies between otherwise identical messages upstream.
    const source: string | null = typeof f.message === 'string' ? f.message.trim() : null;
    const translations = translate(source);
    if (source && !translations['en']) {
      warnings.push(`${id}: no english translation for message`);
    }

    zones.push({
      id,
      sourceId: SOURCE_ID,
      name: f.name ?? id,
      restriction,
      reasons: (f.reason ?? []).map((r: string) => String(r).toUpperCase()),
      altitude: {
        lower: g.lowerLimit ?? 0,
        upper: g.upperLimit ?? 0,
        unit: 'm',
        reference,
      },
      geometry,
      bbox,
      applicability,
      authority: {
        name: auth.name || 'unknown',
        contactName: auth.contactName || undefined,
        email: auth.email || undefined,
        phone: auth.phone || undefined,
        noticeDays: noticeDaysFrom(source),
      },
      text: { source, translations },
      conditions: (f.restrictionConditions ?? []).map((c: string) => c.trim()),
    });
  }

  return { zones, warnings };
}
