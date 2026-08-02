import type { NormalizedZone, Restriction, ZoneGeometry } from '../../shared/zone';
import messagesEn from './messages.en.json' with { type: 'json' };

const SOURCE_ID = 'cyprus';
const TRANSLATIONS = messagesEn as Record<string, string>;

const RESTRICTIONS: Record<string, Restriction> = {
  PROHIBITED: 'PROHIBITED',
  REQ_AUTHORISATION: 'REQ_AUTHORISATION',
  REQ_AUTHORIZATION: 'REQ_AUTHORISATION',
  CONDITIONAL: 'CONDITIONAL',
  NO_RESTRICTION: 'NO_RESTRICTION',
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
 * The DCA states required notice inside the message, in weeks:
 * "Υποβολή αίτησης τουλάχιστον 2 βδομάδες πριν…".
 */
export function noticeDaysFrom(message: string | null): number | undefined {
  if (!message) return undefined;
  const m = message.match(/τουλάχιστον\s+(\d+)\s+(βδομάδ|εβδομάδ)/i);
  return m ? Number(m[1]) * 7 : undefined;
}

export function normalize(raw: string): { zones: NormalizedZone[]; warnings: string[] } {
  const warnings: string[] = [];
  const doc = JSON.parse(raw.replace(/^﻿/, ''));
  if (!Array.isArray(doc?.features)) {
    throw new Error('unexpected payload: no features array');
  }

  const zones: NormalizedZone[] = [];
  for (const f of doc.features) {
    const baseId = `CYP-${f.identifier}`;

    const restriction = RESTRICTIONS[String(f.restriction ?? '').toUpperCase()];
    if (!restriction) {
      warnings.push(`${baseId}: unknown restriction "${f.restriction}"`);
      continue;
    }

    const parts = Array.isArray(f.geometry) ? f.geometry : [];
    if (parts.length === 0) {
      warnings.push(`${baseId}: missing geometry`);
      continue;
    }

    const app = f.applicability?.[0] ?? { permanent: 'YES' };
    const applicability =
      String(app.permanent).toUpperCase() === 'YES'
        ? ({ permanent: true } as const)
        : ({ permanent: false, start: app.startDateTime, end: app.endDateTime } as const);

    const auth = f.zoneAuthority?.[0] ?? {};
    const source: string | null = typeof f.message === 'string' ? f.message.trim() || null : null;
    const translations: Record<string, string> = {};
    if (source) {
      const en = TRANSLATIONS[source];
      if (en) translations['en'] = en;
      else warnings.push(`${baseId}: no english translation for message`);
    }

    for (const [i, g] of parts.entries()) {
      const id = parts.length > 1 ? `${baseId}-${i + 1}` : baseId;

      const hp = g?.horizontalProjection;
      if (!hp) {
        warnings.push(`${id}: missing horizontalProjection`);
        continue;
      }

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

      zones.push({
        id,
        sourceId: SOURCE_ID,
        name: f.name ?? baseId,
        restriction,
        reasons: (f.reason ?? []).map((r: string) => String(r).toUpperCase()),
        altitude: {
          lower: g.lowerLimit ?? 0,
          upper: g.upperLimit ?? null,
          unit: 'm',
          reference: g.upperVerticalReference === 'AMSL' ? 'AMSL' : 'AGL',
        },
        geometry,
        bbox,
        applicability,
        authority: {
          name: auth.name || 'unknown',
          contactName: auth.contactName || undefined,
          email: auth.email || undefined,
          phone: auth.phone || undefined,
          siteUrl: auth.siteURL || undefined,
          noticeDays: noticeDaysFrom(source),
        },
        text: { source, translations },
        conditions: (f.restrictionConditions ?? []).map((c: string) => c.trim()),
      });
    }
  }

  return { zones, warnings };
}
