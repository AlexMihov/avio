import type { NormalizedZone, Restriction } from '../../shared/zone';

const SOURCE_ID = 'ireland';

/** The IAA spells the level with a z and puts it in `type` rather than `restriction`. */
const RESTRICTIONS: Record<string, Restriction> = {
  PROHIBITED: 'PROHIBITED',
  REQ_AUTHORIZATION: 'REQ_AUTHORISATION',
  REQ_AUTHORISATION: 'REQ_AUTHORISATION',
  CONDITIONAL: 'CONDITIONAL',
  NO_RESTRICTION: 'NO_RESTRICTION',
};

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
 * `restrictionConditions` is a coded string rather than prose: `PERMITTED/MODEL AIRCRAFT=YES`,
 * `EXEMPT/MACI MEMBER=YES`. Turned into something a reader can act on, with the code kept
 * verbatim when it does not match a form we know.
 */
export function readCondition(code: string | null | undefined): string | null {
  if (!code) return null;
  const m = code.match(/^([A-Z]+)\/(.+)=YES$/i);
  if (!m) return code.trim() || null;
  const [, verb, subject] = m;
  const who = subject.toLowerCase().replace(/\s+/g, ' ').trim();
  return verb.toUpperCase() === 'EXEMPT'
    ? `Exempt from this zone: ${who}.`
    : `Permitted in this zone: ${who}.`;
}

/** The IAA gives some zones a list of windows; the model holds one, so they are listed. */
export function readWindows(
  windows: { startDateTime?: string; endDateTime?: string }[] | null | undefined,
): string | null {
  if (!windows?.length) return null;
  const days = windows
    .map((w) => (w.startDateTime ?? '').slice(0, 10))
    .filter(Boolean)
    .filter((day, i, all) => all.indexOf(day) === i);
  return days.length ? `Applies on: ${days.join(', ')}.` : null;
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
    const baseId = `IRL-${p['identifier']}`;

    const restriction = RESTRICTIONS[String(p['type'] ?? '').toUpperCase()];
    if (!restriction) {
      warnings.push(`${baseId}: unknown restriction "${p['type']}"`);
      continue;
    }

    const g = feature?.geometry;
    if (!g) {
      warnings.push(`${baseId}: missing geometry`);
      continue;
    }
    // Every Irish zone is a MultiPolygon; each part becomes its own zone so no ring is lost.
    const polygons: [number, number][][][] =
      g.type === 'MultiPolygon' ? g.coordinates : g.type === 'Polygon' ? [g.coordinates] : [];
    if (!polygons.length) {
      warnings.push(`${baseId}: unsupported geometry type "${g.type}"`);
      continue;
    }

    const windows = p['limitedApplicability'] as
      | { startDateTime?: string; endDateTime?: string }[]
      | null;
    if (windows?.length) {
      // Several separate windows cannot be expressed as one; the zone stays visible and the
      // dates are stated, rather than hiding a zone that may well be active.
      warnings.push(`${baseId}: ${windows.length} applicability windows, listed as a condition`);
    }

    const conditions = [
      readCondition(p['restrictionConditions'] as string | null),
      readWindows(windows),
      typeof p['otherReasonInfo'] === 'string' && p['otherReasonInfo'].trim()
        ? p['otherReasonInfo'].trim()
        : null,
    ].filter((c): c is string => Boolean(c));

    const auth = (p['zoneAuthority'] as Record<string, string | null>[] | undefined)?.[0] ?? {};
    const message = typeof p['message'] === 'string' ? p['message'].trim() || null : null;
    const reason = String(p['reason'] ?? '').trim().toUpperCase();

    for (const [i, rings] of polygons.entries()) {
      zones.push({
        id: polygons.length > 1 ? `${baseId}-${i + 1}` : baseId,
        sourceId: SOURCE_ID,
        name: String(p['name'] ?? baseId),
        restriction,
        reasons: reason ? [reason] : [],
        // The IAA publishes no vertical limits at all, so every zone is ground to unlimited.
        altitude: { lower: 0, upper: null, unit: 'm', reference: 'AGL' },
        geometry: { kind: 'polygon', rings },
        bbox: ringsBbox(rings),
        applicability: { permanent: true },
        authority: {
          name: auth['name'] || 'unknown',
          contactName: auth['contactName'] || undefined,
          email: auth['email'] || undefined,
          phone: auth['phone'] || undefined,
          siteUrl: auth['siteURL'] || undefined,
        },
        text: { source: message, translations: {} },
        conditions,
      });
    }
  }

  return { zones, warnings };
}
