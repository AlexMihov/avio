import { manifest } from './manifest';
import { request, retry } from '../http';

/**
 * The DCA links a date-stamped JSON from its geo-zones page, so the current file has to be
 * discovered rather than assumed. The release date is in the document title as
 * `CYPZoneVersion DD-MM-YYYY`.
 */
export async function fetchZones(): Promise<{
  raw: string;
  sourceUrl: string;
  publishedAt: string;
}> {
  const page = await request(manifest.officialUrl).then((r) => {
    if (!r.ok) throw new Error(`geo-zones page returned ${r.status}`);
    return r.text();
  });

  const match = page.match(/href="([^"]+\.json[^"]*)"/i);
  if (!match) throw new Error('no .json link found on the DCA geo-zones page');
  const sourceUrl = new URL(match[1], manifest.officialUrl).toString();

  const [raw, zones] = await retry(async () => {
    const r = await request(sourceUrl);
    if (!r.ok) throw new Error(`zone download returned ${r.status}`);
    const text = await r.text();
    return [text, JSON.parse(text)] as const;
  });

  return { raw, sourceUrl, publishedAt: publishedAtFrom(zones?.title) };
}

/** `CYPZoneVersion DD-MM-YYYY` is the only date the DCA publishes. */
export function publishedAtFrom(title: unknown): string {
  const m = String(title ?? '').match(/(\d{2})-(\d{2})-(\d{4})/);
  if (!m) throw new Error(`no release date in title ${JSON.stringify(title)}`);
  return `${m[3]}-${m[2]}-${m[1]}`;
}
