export type LonLat = [number, number];
/** minLon, minLat, maxLon, maxLat */
export type Bbox = [number, number, number, number];

const EARTH_R = 6_371_008.8;
const rad = (deg: number) => (deg * Math.PI) / 180;

export function haversineM(a: LonLat, b: LonLat): number {
  const dLat = rad(b[1] - a[1]);
  const dLon = rad(b[0] - a[0]);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_R * Math.asin(Math.min(1, Math.sqrt(s)));
}

export function inBbox(p: LonLat, b: Bbox): boolean {
  return p[0] >= b[0] && p[0] <= b[2] && p[1] >= b[1] && p[1] <= b[3];
}

export function pointInCircle(p: LonLat, c: { center: LonLat; radiusM: number }): boolean {
  return haversineM(p, c.center) <= c.radiusM;
}

function inRing(p: LonLat, ring: LonLat[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const straddles = yi > p[1] !== yj > p[1];
    if (straddles && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/** The first ring is the outer boundary; any further rings are holes. */
export function pointInPolygon(p: LonLat, rings: LonLat[][]): boolean {
  if (rings.length === 0 || !inRing(p, rings[0])) return false;
  for (let i = 1; i < rings.length; i++) {
    if (inRing(p, rings[i])) return false;
  }
  return true;
}
