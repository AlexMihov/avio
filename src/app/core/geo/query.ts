import type { NormalizedZone } from '../../../../shared/zone';
import { STRICTNESS } from '../../../../shared/zone';
import { inBbox, pointInCircle, pointInPolygon, type LonLat } from './geometry';

export interface ZoneMatch {
  zone: NormalizedZone;
}

function containsPoint(zone: NormalizedZone, p: LonLat): boolean {
  if (!inBbox(p, zone.bbox)) return false;
  return zone.geometry.kind === 'circle'
    ? pointInCircle(p, zone.geometry)
    : pointInPolygon(p, zone.geometry.rings);
}

function activeAt(zone: NormalizedZone, when: Date): boolean {
  if (zone.applicability.permanent) return true;
  const { start, end } = zone.applicability;
  return new Date(start) <= when && when <= new Date(end);
}

/**
 * Every zone that applies to a flight at `heightM` above ground level at `point`.
 * Overlapping zones are all returned; they are never merged.
 */
export function queryZones(
  zones: NormalizedZone[],
  point: LonLat,
  heightM: number,
  when: Date = new Date(),
): ZoneMatch[] {
  return zones
    .filter(
      (z) =>
        heightM >= z.altitude.lower && (z.altitude.upper === null || heightM <= z.altitude.upper),
    )
    .filter((z) => activeAt(z, when))
    .filter((z) => containsPoint(z, point))
    .sort(
      (a, b) =>
        STRICTNESS[b.restriction] - STRICTNESS[a.restriction] ||
        // An unbounded ceiling sorts last: it is the least specific band at this point.
        (a.altitude.upper ?? Infinity) - (b.altitude.upper ?? Infinity),
    )
    .map((zone) => ({ zone }));
}
