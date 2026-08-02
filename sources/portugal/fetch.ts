const ZONES_URL = 'https://dnt.anac.pt/mapa_UASZoneVersion.js';

/**
 * ANAC serves its ED-269 document as the data file of its own map viewer: JavaScript that
 * assigns `data = {…}` rather than JSON. There is no `.json` or `.kml` sibling at this host —
 * the documented downloads sit behind the operator login — so the assignment is stripped here
 * and the rest is parsed as the ED-269 document it is.
 */
export async function fetchZones(): Promise<{
  raw: string;
  sourceUrl: string;
  publishedAt: string;
}> {
  const script = await fetch(ZONES_URL).then((r) => {
    if (!r.ok) throw new Error(`zone download returned ${r.status}`);
    return r.text();
  });

  const start = script.indexOf('{');
  if (start === -1) throw new Error('no JSON object in the zone script');
  const raw = script.slice(start).replace(/;\s*$/, '').trim();

  const doc = JSON.parse(raw);
  return { raw, sourceUrl: ZONES_URL, publishedAt: publishedAtFrom(doc?.description) };
}

/** ANAC stamps the release into a description as `Version: DDMMYYYYHHMMSS`. */
export function publishedAtFrom(description: unknown): string {
  const match = String(description ?? '').match(/(\d{2})(\d{2})(\d{4})\d{6}/);
  if (!match) throw new Error(`no release stamp in description ${JSON.stringify(description)}`);
  const [, dd, mm, yyyy] = match;
  return `${yyyy}-${mm}-${dd}`;
}
