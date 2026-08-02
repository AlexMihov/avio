import type { NormalizedZone, Restriction, ZoneGeometry } from '../../shared/zone';

const SOURCE_ID = 'estonia';

const RESTRICTIONS: Record<string, Restriction> = {
  PROHIBITED: 'PROHIBITED',
  REQ_AUTHORISATION: 'REQ_AUTHORISATION',
  REQ_AUTHORIZATION: 'REQ_AUTHORISATION',
  CONDITIONAL: 'CONDITIONAL',
  NO_RESTRICTION: 'NO_RESTRICTION',
};

/** EANS writes the reason as prose rather than as the ED-269 code. */
const REASONS: Record<string, string> = {
  'air traffic': 'AIR_TRAFFIC',
  nature: 'NATURE',
  sensitive: 'SENSITIVE',
  privacy: 'PRIVACY',
  population: 'POPULATION',
  'foreign territory': 'FOREIGN_TERRITORY',
  emergency: 'EMERGENCY',
  other: 'OTHER',
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

/** No real zone spans the entire planet; one that does is describing the absence of coverage. */
function coversTheGlobe([minLon, minLat, maxLon, maxLat]: [number, number, number, number]): boolean {
  return minLon <= -179 && maxLon >= 179 && minLat <= -89 && maxLat >= 89;
}

interface Localized {
  language?: string;
  message?: string;
}

/**
 * EANS carries the Estonian and English wording in extendedProperties.localizedMessages,
 * tagged `et-EE` and `en-GB`. Both are the authority's own.
 */
export function textOf(props: Record<string, unknown>): {
  source: string | null;
  translations: Record<string, string>;
} {
  const extended = (props['extendedProperties'] ?? {}) as { localizedMessages?: Localized[] };
  const translations: Record<string, string> = {};
  let source: string | null = null;

  for (const entry of extended.localizedMessages ?? []) {
    const lang = String(entry.language ?? '').slice(0, 2).toLowerCase();
    const message = typeof entry.message === 'string' ? entry.message.trim() : '';
    if (!lang || !message) continue;
    if (lang === 'et') source = message;
    else translations[lang] = message;
  }

  // The top-level message is the English one; keep it if the localized list was empty.
  const fallback = typeof props['message'] === 'string' ? props['message'].trim() : '';
  if (!source && !Object.keys(translations).length && fallback) return { source: fallback, translations };
  if (!translations['en'] && fallback) translations['en'] = fallback;
  return { source, translations };
}

export function normalize(raw: string): { zones: NormalizedZone[]; warnings: string[] } {
  const warnings: string[] = [];
  const doc = JSON.parse(raw.replace(/^﻿/, ''));
  if (!Array.isArray(doc?.features)) {
    throw new Error('unexpected payload: no features array');
  }

  const zones: NormalizedZone[] = [];
  for (const feature of doc.features) {
    const p = (feature?.properties ?? {}) as Record<string, unknown>;
    const id = `EST-${p['identifier']}`;

    // EANS ships zones it does not want shown; honouring the flag keeps us in step with it.
    if (p['hidden'] === true) continue;

    const restriction = RESTRICTIONS[String(p['restriction'] ?? '').toUpperCase()];
    if (!restriction) {
      warnings.push(`${id}: unknown restriction "${p['restriction']}"`);
      continue;
    }

    const hp = feature?.geometry;
    if (!hp) {
      warnings.push(`${id}: missing geometry`);
      continue;
    }

    let geometry: ZoneGeometry;
    let bbox: [number, number, number, number];
    if (hp.type === 'Polygon') {
      const rings = hp.coordinates as [number, number][][];
      geometry = { kind: 'polygon', rings };
      bbox = ringsBbox(rings);
      // EANS ships "Outside Estonia": the whole globe with the country punched out as a hole.
      // It is an out-of-jurisdiction notice for their own UTM app, not a geographical zone,
      // and keeping it would make every point in every other country read as prohibited.
      if (coversTheGlobe(bbox)) {
        warnings.push(`${id}: covers the whole globe, treated as an out-of-jurisdiction notice`);
        continue;
      }
    } else if (hp.type === 'Point' && typeof p['radius'] === 'number') {
      const center: [number, number] = [hp.coordinates[0], hp.coordinates[1]];
      geometry = { kind: 'circle', center, radiusM: p['radius'] };
      bbox = circleBbox(center, p['radius']);
    } else {
      warnings.push(`${id}: unsupported geometry type "${hp.type}"`);
      continue;
    }

    // The vertical band sits in properties.geometry, ED-269 style, with metre values already
    // resolved alongside it — so no unit conversion is needed here.
    const band = (p['geometry'] ?? {}) as Record<string, unknown>;
    const lower = typeof p['lowerMeters'] === 'number' ? p['lowerMeters'] : Number(band['lowerLimit'] ?? 0);
    const upperRaw = typeof p['upperMeters'] === 'number' ? p['upperMeters'] : band['upperLimit'];
    const reference = band['upperVerticalReference'] === 'AMSL' ? 'AMSL' : 'AGL';

    const app = (p['applicability'] as { permanent?: string; startDateTime?: string; endDateTime?: string }[] | undefined)?.[0] ?? {
      permanent: 'YES',
    };
    const applicability =
      String(app.permanent).toUpperCase() === 'YES'
        ? ({ permanent: true } as const)
        : ({ permanent: false, start: app.startDateTime!, end: app.endDateTime! } as const);

    const auth = (p['zoneAuthority'] as Record<string, string>[] | undefined)?.[0] ?? {};
    const reasonWord = String(p['reason'] ?? '').trim().toLowerCase();
    const reason = REASONS[reasonWord];
    if (reasonWord && !reason) warnings.push(`${id}: unmapped reason "${p['reason']}"`);

    zones.push({
      id,
      sourceId: SOURCE_ID,
      name: String(p['name'] ?? id),
      restriction,
      reasons: reason ? [reason] : [],
      altitude: {
        lower,
        upper: typeof upperRaw === 'number' ? upperRaw : null,
        unit: 'm',
        reference,
      },
      geometry,
      bbox,
      applicability,
      authority: {
        name: auth['name'] || 'unknown',
        contactName: auth['contactName'] || undefined,
        email: auth['email'] || undefined,
        phone: auth['phone'] || undefined,
        siteUrl: auth['siteURL'] || undefined,
      },
      text: textOf(p),
      conditions: [],
    });
  }

  return { zones, warnings };
}
