import type { LonLat } from './geo/geometry';

export interface PermalinkState {
  point: LonLat | null;
  heightM: number | null;
  sources: string[];
  /** Unvalidated: the caller knows which locales exist. */
  locale: string | null;
}

/**
 * `?at=<lat>,<lon>&h=<metres>&src=<id>[,<id>…]&lang=<locale>` — so a pilot can send someone
 * the exact query, in the language they were reading it in.
 */
export function parsePermalink(search: string): PermalinkState {
  const params = new URLSearchParams(search);
  const at = params.get('at');
  const h = params.get('h');

  let point: LonLat | null = null;
  if (at) {
    const [lat, lon] = at.split(',').map(Number);
    if (Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
      point = [lon, lat];
    }
  }

  const heightM = h !== null && Number.isFinite(Number(h)) ? Number(h) : null;
  const sources = (params.get('src') ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
  return { point, heightM, sources, locale: params.get('lang') };
}

export function buildPermalink(state: PermalinkState): string {
  const params = new URLSearchParams();
  if (state.point) {
    params.set('at', `${state.point[1].toFixed(5)},${state.point[0].toFixed(5)}`);
  }
  if (state.heightM !== null) params.set('h', String(state.heightM));
  if (state.sources.length) params.set('src', state.sources.join(','));
  if (state.locale) params.set('lang', state.locale);
  // A comma is legal in a query string and keeps shared links readable.
  const query = params.toString().replace(/%2C/g, ',');
  return query ? `?${query}` : location.pathname;
}
