import { STRICTNESS } from '../../../../shared/zone';
import { inBbox, pointInCircle, pointInPolygon } from './geometry';
function containsPoint(zone, p) {
    if (!inBbox(p, zone.bbox))
        return false;
    return zone.geometry.kind === 'circle'
        ? pointInCircle(p, zone.geometry)
        : pointInPolygon(p, zone.geometry.rings);
}
function activeAt(zone, when) {
    if (zone.applicability.permanent)
        return true;
    const { start, end } = zone.applicability;
    return new Date(start) <= when && when <= new Date(end);
}
/**
 * Every zone that applies to a flight at `heightM` above ground level at `point`.
 * Overlapping zones are all returned; they are never merged.
 */
export function queryZones(zones, point, heightM, when = new Date()) {
    return zones
        .filter((z) => heightM >= z.altitude.lower && heightM <= z.altitude.upper)
        .filter((z) => activeAt(z, when))
        .filter((z) => containsPoint(z, point))
        .sort((a, b) => STRICTNESS[b.restriction] - STRICTNESS[a.restriction] ||
        a.altitude.upper - b.altitude.upper)
        .map((zone) => ({ zone }));
}
