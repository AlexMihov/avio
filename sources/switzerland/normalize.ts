import type { NormalizedZone, Restriction, ZoneGeometry } from '../../shared/zone';

const SOURCE_ID = 'switzerland';

const RESTRICTIONS: Record<string, Restriction> = {
  PROHIBITED: 'PROHIBITED',
  REQ_AUTHORISATION: 'REQ_AUTHORISATION',
  CONDITIONAL: 'CONDITIONAL',
};

/** FOCA's sentinel for "no ceiling"; it is never a real limit. */
const NO_CEILING = 99999;

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
 * ED-269 states the required notice as an ISO 8601 duration, e.g. "P07DT00H" or "P1M".
 * Rounded up, because a partial day of notice is still a day the operator has to allow for.
 */
export function noticeDaysFrom(interval: string | undefined): number | undefined {
  if (!interval) return undefined;
  const m = interval.match(/^P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?)?$/);
  if (!m) return undefined;
  const [, y, mo, w, d, h] = m.map((v) => (v === undefined ? 0 : Number(v)));
  const days = y * 365 + mo * 30 + w * 7 + d + (h > 0 ? Math.ceil(h / 24) : 0);
  return days > 0 ? days : undefined;
}

interface SwissTexts {
  name: Record<string, string>;
  message: Record<string, string>;
  condition: Record<string, string>;
  authority: Record<string, string>;
}

export function normalize(raw: string): { zones: NormalizedZone[]; warnings: string[] } {
  const warnings: string[] = [];
  const payload = JSON.parse(raw);
  const doc = payload?.ed269;
  const texts: Record<string, SwissTexts> = payload?.texts ?? {};
  if (!Array.isArray(doc?.features)) {
    throw new Error('unexpected payload: no ed269.features array');
  }

  const zones: NormalizedZone[] = [];
  for (const f of doc.features) {
    const baseId = `CHE-${f.identifier}`;

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
    // Recurring daily windows are not in the zone model yet, so say so rather than imply
    // the zone is active around the clock.
    if ((app.dailyPeriod ?? []).some((p: { startTime?: string }) => p.startTime)) {
      warnings.push(`${baseId}: daily time window is published but not modelled`);
    }

    const auth = f.zoneAuthority?.[0] ?? {};
    if ((f.zoneAuthority ?? []).length > 1) {
      warnings.push(`${baseId}: ${f.zoneAuthority.length} authorities, only the first is used`);
    }

    const source: string | null = typeof f.message === 'string' ? f.message.trim() || null : null;

    // The ED-269 file is English only; the GeoPackage carries the authority's own DE/FR/IT.
    const localised = texts[f.identifier];
    if (!localised) {
      warnings.push(`${baseId}: no geopackage row, only the english text is available`);
    }
    const conditions: string[] = (f.restrictionConditions ?? []).map((c: string) => c.trim());
    const conditionTranslations: Record<string, string[]> = {};
    for (const [locale, text] of Object.entries(localised?.condition ?? {})) {
      conditionTranslations[locale] = [text];
    }
    if (localised && conditions.length > 1) {
      // The GeoPackage has one condition column, so it cannot represent a multi-condition zone.
      warnings.push(`${baseId}: ${conditions.length} conditions, only the first is localised`);
    }

    // Each geometry carries its own vertical band, so a multi-part zone becomes one zone per
    // part rather than losing every part after the first.
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

      const rawUpper = g.upperLimit;
      const upper = rawUpper === undefined || rawUpper >= NO_CEILING ? null : rawUpper;
      // A vertical reference only means something for a limit that exists; FOCA leaves it at
      // AMSL on unbounded ceilings, which would otherwise mislabel the band.
      const reference =
        upper === null
          ? g.lowerVerticalReference === 'AMSL'
            ? 'AMSL'
            : 'AGL'
          : g.upperVerticalReference === 'AMSL'
            ? 'AMSL'
            : 'AGL';
      if (upper !== null && g.upperVerticalReference !== g.lowerVerticalReference) {
        warnings.push(
          `${id}: mixed vertical references (${g.lowerVerticalReference}/${g.upperVerticalReference}) on a bounded band`,
        );
      }

      zones.push({
        id,
        sourceId: SOURCE_ID,
        name: f.name ?? baseId,
        restriction,
        reasons: (f.reason ?? []).map((r: string) => String(r).toUpperCase()),
        altitude: { lower: g.lowerLimit ?? 0, upper, unit: 'm', reference },
        geometry,
        bbox,
        applicability,
        authority: {
          name: auth.name || 'unknown',
          nameTranslations: localised?.authority,
          contactName: auth.contactName || undefined,
          email: auth.email || undefined,
          phone: auth.phone || undefined,
          siteUrl: auth.siteURL || undefined,
          noticeDays: noticeDaysFrom(auth.intervalBefore),
        },
        // Every one of these is FOCA's own wording, not a translation we made.
        text: { source, translations: localised?.message ?? {} },
        conditions,
        conditionTranslations: Object.keys(conditionTranslations).length
          ? conditionTranslations
          : undefined,
      });
    }
  }

  return { zones, warnings };
}
