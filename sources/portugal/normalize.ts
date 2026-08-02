import type { NormalizedZone, Restriction, ZoneGeometry } from '../../shared/zone';

const SOURCE_ID = 'portugal';

const RESTRICTIONS: Record<string, Restriction> = {
  PROHIBITED: 'PROHIBITED',
  REQ_AUTHORISATION: 'REQ_AUTHORISATION',
  CONDITIONAL: 'CONDITIONAL',
  NO_RESTRICTION: 'NO_RESTRICTION',
};

const EARTH_R = 6_371_008.8;

/** ANAC states three of its nature-reserve ceilings in feet; the model is metres throughout. */
const FEET_TO_M = 0.3048;

function toMetres(value: number | null | undefined, unit: string): number | null {
  if (value === null || value === undefined) return null;
  return unit === 'FT' ? Math.round(value * FEET_TO_M) : value;
}

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
 * ANAC writes both languages into one `message`, marked `PT-…` and `EN-…`, sometimes with a
 * space or a dash after the tag. Both halves are the authority's own wording, so the
 * Portuguese becomes the source text and the English a published translation rather than ours.
 */
export function splitBilingual(message: string | null): {
  pt: string | null;
  en: string | null;
} {
  if (!message) return { pt: null, en: null };
  const marker = message.search(/\bEN\s*-\s*/);
  if (marker === -1) {
    return { pt: message.replace(/^\s*PT\s*-\s*/, '').trim() || null, en: null };
  }
  const pt = message.slice(0, marker).replace(/^\s*PT\s*-\s*/, '').trim();
  const en = message.slice(marker).replace(/^\s*EN\s*-\s*/, '').trim();
  return { pt: pt || null, en: en || null };
}

export function normalize(raw: string): { zones: NormalizedZone[]; warnings: string[] } {
  const warnings: string[] = [];
  const doc = JSON.parse(raw.replace(/^﻿/, ''));
  if (!Array.isArray(doc?.features)) {
    throw new Error('unexpected payload: no features array');
  }

  const zones: NormalizedZone[] = [];
  for (const f of doc.features) {
    const baseId = `PRT-${f.identifier}`;

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
    const message: string | null = typeof f.message === 'string' ? f.message.trim() || null : null;
    const { pt, en } = splitBilingual(message);
    if (message && !pt) warnings.push(`${baseId}: message has no portuguese half`);

    const reasons = (f.reason ?? []).map((r: string) => String(r).toUpperCase());
    // ANAC states the nature of a few zones only in otherReasonInfo, e.g. "Hospital Helipad".
    const conditions = f.otherReasonInfo ? [String(f.otherReasonInfo).trim()] : [];

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

      // Feet are converted rather than flagged; anything else is a unit we cannot honour.
      if (g.uomDimensions !== 'M' && g.uomDimensions !== 'FT') {
        warnings.push(`${id}: unsupported vertical unit "${g.uomDimensions}"`);
        continue;
      }
      if (g.upperVerticalReference !== g.lowerVerticalReference) {
        warnings.push(
          `${id}: mixed vertical references (${g.lowerVerticalReference}/${g.upperVerticalReference})`,
        );
      }
      const reference = g.upperVerticalReference === 'AMSL' ? 'AMSL' : 'AGL';

      zones.push({
        id,
        sourceId: SOURCE_ID,
        name: f.name ?? baseId,
        restriction,
        reasons,
        altitude: {
          lower: toMetres(g.lowerLimit, g.uomDimensions) ?? 0,
          upper: toMetres(g.upperLimit, g.uomDimensions),
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
          siteUrl: auth.siteURL || undefined,
        },
        text: { source: pt, translations: en ? { en } : {} },
        conditions,
      });
    }
  }

  return { zones, warnings };
}
