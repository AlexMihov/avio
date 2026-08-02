export type Consent = 'unknown' | 'granted' | 'denied';

export const CONSENT_KEY = 'avio.analytics-consent';

export function readConsent(value: string | null | undefined): Consent {
  return value === 'granted' || value === 'denied' ? value : 'unknown';
}

/**
 * The address bar carries the query: `?at=51.8,-8.5&h=50&src=ireland`. That is the point a
 * pilot intends to fly at and how high — the one thing this app knows that a visitor would
 * not expect to leave their browser. Analytics gets the page, never the question.
 */
export function pageLocation(href: string): string {
  try {
    const url = new URL(href);
    return url.origin + url.pathname;
  } catch {
    // Not a URL we can parse; send nothing rather than risk sending the query string.
    return '';
  }
}

/** A measurement id is `G-` followed by an alphanumeric tag; anything else is a typo. */
export function isMeasurementId(value: string | null | undefined): boolean {
  return typeof value === 'string' && /^G-[A-Z0-9]{4,}$/i.test(value.trim());
}

/**
 * What a query is allowed to report: which authority's data was read, in which language, and
 * whether anything applied. Deliberately not the point or the height — those are the flight
 * plan. Countries are sorted so the same selection is one value however it was clicked, and
 * the count is bucketed because the exact number adds nothing an aggregate needs.
 */
export interface QueryEvent {
  sources: string;
  locale: string;
  outcome: 'clear' | '1' | '2-3' | '4+';
  area: string;
}

/**
 * Reported location is snapped to a tenth of a degree — roughly 11 km north–south, and 7 km
 * east–west at Swiss latitudes. Enough to see that people are checking around Zürich or the
 * Algarve; not enough to say which field, and not enough to follow one person around.
 */
export const GRID_DEGREES = 0.1;

export function gridCell(point: readonly [number, number] | null): string {
  if (!point) return 'none';
  const snap = (v: number) => (Math.round(v / GRID_DEGREES) * GRID_DEGREES).toFixed(1);
  // Latitude first, the way the app writes coordinates everywhere else.
  return `${snap(point[1])},${snap(point[0])}`;
}

export function queryEvent(
  sources: readonly string[],
  locale: string,
  zonesFound: number,
  point: readonly [number, number] | null,
): QueryEvent {
  const outcome: QueryEvent['outcome'] =
    zonesFound === 0 ? 'clear' : zonesFound === 1 ? '1' : zonesFound <= 3 ? '2-3' : '4+';
  return { sources: [...sources].sort().join(','), locale, outcome, area: gridCell(point) };
}
