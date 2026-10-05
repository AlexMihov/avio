import { request } from '../http';

const ZONES_URL = 'https://dnt.anac.pt/index.php?action=download-json-ed269';

/**
 * ANAC's map viewer links its ED-269 document as a public download. Until late September 2026
 * the only public copy was the viewer's own `mapa_UASZoneVersion.js`, which the redesigned
 * site replaced with an HTML page.
 */
export async function fetchZones(): Promise<{
  raw: string;
  sourceUrl: string;
  publishedAt: string;
}> {
  const raw = await request(ZONES_URL).then((r) => {
    if (!r.ok) throw new Error(`zone download returned ${r.status}`);
    return r.text();
  });

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
