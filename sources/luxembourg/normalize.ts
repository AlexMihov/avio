import type { NormalizedZone, Restriction, ZoneGeometry } from '../../shared/zone';

const SOURCE_ID = 'luxembourg';

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

export function normalize(raw: string): { zones: NormalizedZone[]; warnings: string[] } {
  const warnings: string[] = [];
  const doc = JSON.parse(raw.replace(/^﻿/, ''));
  if (!Array.isArray(doc?.features)) {
    throw new Error('unexpected payload: no features array');
  }

  const zones: NormalizedZone[] = [];
  for (const f of doc.features) {
    const baseId = `LUX-${f.identifier}`;

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

    // The DAC gives every zone a validity window, including the ones that are effectively
    // permanent; they carry a far-future end date rather than permanent: YES.
    const app = f.applicability?.[0] ?? { permanent: 'YES' };
    const applicability =
      String(app.permanent).toUpperCase() === 'YES'
        ? ({ permanent: true } as const)
        : ({ permanent: false, start: app.startDateTime, end: app.endDateTime } as const);
    if (!applicability.permanent && !(app.startDateTime && app.endDateTime)) {
      warnings.push(`${baseId}: non-permanent zone without a complete window`);
    }

    const auth = f.zoneAuthority?.[0] ?? {};
    const source: string | null = typeof f.message === 'string' ? f.message.trim() || null : null;

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
      const reference = g.upperVerticalReference === 'AMSL' ? 'AMSL' : 'AGL';

      zones.push({
        id,
        sourceId: SOURCE_ID,
        name: f.name ?? baseId,
        restriction,
        reasons: (f.reason ?? []).map((r: string) => String(r).toUpperCase()),
        altitude: { lower: g.lowerLimit ?? 0, upper: g.upperLimit ?? null, unit: 'm', reference },
        geometry,
        bbox,
        applicability,
        authority: {
          name: auth.name || 'unknown',
          email: auth.email || undefined,
          phone: auth.phone || undefined,
        },
        text: { source, translations: {} },
        // The DAC states its conditions in the message rather than in a dedicated field.
        conditions: (f.restrictionConditions ?? []).map((c: string) => c.trim()),
      });
    }
  }

  return { zones, warnings };
}
