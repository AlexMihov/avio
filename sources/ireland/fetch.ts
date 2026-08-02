import { manifest } from './manifest';
import { request } from '../http';

const ORIGIN = 'https://www.iaa.ie';

/**
 * The IAA links a date-stamped GeoJSON from its zones page, so the current file has to be
 * discovered. The document carries a proper datasetMetadata.issued, unlike most sources.
 */
export async function fetchZones(): Promise<{
  raw: string;
  sourceUrl: string;
  publishedAt: string;
}> {
  const page = await request(manifest.officialUrl).then((r) => {
    if (!r.ok) throw new Error(`zones page returned ${r.status}`);
    return r.text();
  });

  const match = page.match(/href="([^"]*uas_zones_ireland[^"]*\.geojson[^"]*)"/i);
  if (!match) throw new Error('no uas_zones_ireland .geojson link found on the IAA page');
  const href = match[1].replace(/&amp;/g, '&');
  const sourceUrl = href.startsWith('http') ? href : ORIGIN + href;

  const raw = await request(sourceUrl).then((r) => {
    if (!r.ok) throw new Error(`zone download returned ${r.status}`);
    return r.text();
  });

  const issued = JSON.parse(raw)?.datasetMetadata?.issued;
  if (typeof issued !== 'string') throw new Error('no datasetMetadata.issued in the document');
  return { raw, sourceUrl, publishedAt: issued.slice(0, 10) };
}
