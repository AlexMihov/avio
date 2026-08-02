import type { NormalizedZone } from '../shared/zone';

/** Flag a source when this share of its zones is inside the horizon. */
const SHARE_THRESHOLD = 0.25;

/** How far ahead to look for zones that are about to lapse. */
export const HORIZON_DAYS = 120;

/**
 * Some authorities give every zone a validity window rather than marking it permanent, so a
 * whole country can lapse on one date and the map goes quiet without anything failing.
 * Luxembourg publishes 47 zones and 29 of them end on the same day. These warnings put that
 * in meta.json before it happens rather than after someone notices an empty map.
 */
export function expiryWarnings(
  zones: NormalizedZone[],
  now: Date,
  horizonDays = HORIZON_DAYS,
): string[] {
  if (zones.length === 0) return [];
  const horizon = new Date(now.getTime() + horizonDays * 86_400_000);

  let expired = 0;
  const soon = new Map<string, number>();

  for (const zone of zones) {
    if (zone.applicability.permanent) continue;
    const end = new Date(zone.applicability.end);
    if (Number.isNaN(end.valueOf())) continue;
    if (end < now) {
      expired++;
    } else if (end <= horizon) {
      const day = end.toISOString().slice(0, 10);
      soon.set(day, (soon.get(day) ?? 0) + 1);
    }
  }

  const warnings: string[] = [];
  if (expired > 0) {
    warnings.push(
      `${expired} of ${zones.length} zones have already expired and will not be shown`,
    );
  }

  const total = [...soon.values()].reduce((a, b) => a + b, 0);
  if (total / zones.length > SHARE_THRESHOLD) {
    // Name the date when one day accounts for most of it; that is the cliff to watch.
    const [worstDay, worstCount] = [...soon.entries()].sort((a, b) => b[1] - a[1])[0];
    const where =
      worstCount === total ? ` on ${worstDay}` : `, ${worstCount} of them on ${worstDay}`;
    warnings.push(
      `${total} of ${zones.length} zones expire within ${horizonDays} days${where}; ` +
        `check whether the authority has republished`,
    );
  }

  return warnings;
}
