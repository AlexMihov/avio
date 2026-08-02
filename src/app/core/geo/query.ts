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

/**
 * Whether the zone is in force at `when`. Exported because the map has to agree with the
 * result panel: an expired zone drawn on the map but missing from the list is two answers to
 * one question.
 */
export function isActiveAt(zone: NormalizedZone, when: Date = new Date()): boolean {
  if (zone.applicability.permanent) return true;
  const { start, end } = zone.applicability;
  const from = new Date(start);
  const to = new Date(end);
  // An unreadable window is treated as in force; hiding a zone needs better evidence.
  if (Number.isNaN(from.valueOf()) || Number.isNaN(to.valueOf())) return true;
  return from <= when && when <= to;
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
    .filter((z) => isActiveAt(z, when))
    .filter((z) => containsPoint(z, point))
    .sort(
      (a, b) =>
        STRICTNESS[b.restriction] - STRICTNESS[a.restriction] ||
        // An unbounded ceiling sorts last: it is the least specific band at this point.
        (a.altitude.upper ?? Infinity) - (b.altitude.upper ?? Infinity),
    )
    .map((zone) => ({ zone }));
}
