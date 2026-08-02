/**
 * Authorities publish validity windows at their own offset — Luxembourg and Switzerland in
 * local time with DST, Bulgaria in UTC. Rendering those with `toLocaleString` would silently
 * restate them in whatever timezone the reader's device is in, which for Bulgaria's
 * `23:59:59Z` end dates lands on the following day. These helpers keep the wall clock the
 * authority published and name the offset, so the line means one thing everywhere.
 */

/** Minutes east of UTC declared by an ISO 8601 string, or null when it declares none. */
export function offsetMinutesOf(iso: string): number | null {
  const match = iso.match(/(Z)|([+-])(\d{2}):?(\d{2})$/);
  if (!match) return null;
  if (match[1]) return 0;
  const minutes = Number(match[3]) * 60 + Number(match[4]);
  return match[2] === '-' ? -minutes : minutes;
}

/** `UTC`, `UTC+2`, `UTC+5:30`, `UTC-3` — the shortest form that stays unambiguous. */
export function offsetLabel(minutes: number | null): string {
  if (minutes === null) return '';
  if (minutes === 0) return 'UTC';
  const sign = minutes < 0 ? '-' : '+';
  const abs = Math.abs(minutes);
  const hours = Math.floor(abs / 60);
  const rest = abs % 60;
  return `UTC${sign}${hours}${rest ? `:${String(rest).padStart(2, '0')}` : ''}`;
}

/**
 * The instant as the authority wrote it: shifted onto its declared offset and formatted in
 * UTC, so the digits match the publication rather than the reader's clock.
 */
export function formatAtOffset(
  iso: string,
  locale: string,
  options: Intl.DateTimeFormatOptions,
): string {
  const date = new Date(iso);
  if (Number.isNaN(date.valueOf())) return iso;
  const offset = offsetMinutesOf(iso);
  if (offset === null) return date.toLocaleString(locale, options);
  const shifted = new Date(date.getTime() + offset * 60_000);
  return shifted.toLocaleString(locale, { ...options, timeZone: 'UTC' });
}
