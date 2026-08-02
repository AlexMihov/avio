const ZONES_URL = 'https://drones.geoportail.lu/zones';

/**
 * The geoportal regenerates the file on every request and serves it as an octet-stream
 * attachment with a UTF-8 BOM, so the payload has to be read as text and de-BOMed rather
 * than handed straight to `response.json()`. The release stamp is in the document title,
 * `UASZoneVersion YYYY-MM-DD HH:MM`, and is the only date the DAC publishes.
 */
export async function fetchZones(): Promise<{
  raw: string;
  sourceUrl: string;
  publishedAt: string;
}> {
  const text = await fetch(ZONES_URL).then((r) => {
    if (!r.ok) throw new Error(`zone download returned ${r.status}`);
    return r.text();
  });

  const raw = text.replace(/^﻿/, '');
  const doc = JSON.parse(raw);

  const stamp = String(doc?.title ?? '').match(/(\d{4}-\d{2}-\d{2})/);
  if (!stamp) {
    throw new Error(`no release date in title ${JSON.stringify(doc?.title)}`);
  }

  return { raw, sourceUrl: ZONES_URL, publishedAt: stamp[1] };
}
