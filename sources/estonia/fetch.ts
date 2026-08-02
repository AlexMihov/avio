const ZONES_URL = 'https://utm.eans.ee/avm/utm/uas.geojson';

/**
 * EANS serves a plain GeoJSON whose properties carry the ED-269 fields. There is no release
 * stamp on the document, so the newest per-feature updateDateTime stands in for one.
 */
export async function fetchZones(): Promise<{
  raw: string;
  sourceUrl: string;
  publishedAt: string;
}> {
  const raw = await fetch(ZONES_URL).then((r) => {
    if (!r.ok) throw new Error(`zone download returned ${r.status}`);
    return r.text();
  });

  return { raw, sourceUrl: ZONES_URL, publishedAt: publishedAtFrom(JSON.parse(raw)) };
}

export function publishedAtFrom(doc: { features?: { properties?: Record<string, unknown> }[] }): string {
  let newest = '';
  for (const f of doc.features ?? []) {
    const meta = f.properties?.['metaData'] as { updateDateTime?: string } | undefined;
    const stamp = meta?.updateDateTime;
    if (typeof stamp === 'string' && stamp > newest) newest = stamp;
  }
  if (!newest) throw new Error('no metaData.updateDateTime on any feature');
  return newest.slice(0, 10);
}
