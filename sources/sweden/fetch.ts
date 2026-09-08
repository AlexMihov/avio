import { request } from '../http';

const ED318_URL = 'https://daim.lfv.se/echarts/dronechart/data/uas_zones_ED318.json';
const WFS = 'https://daim.lfv.se/geoserver/wfs';

/**
 * The layers LFV's own drone chart draws, minus the temporary ones (NOTAM and AIP supplements),
 * which change hourly and have no place in a mirror refreshed once a day.
 */
export const AIRSPACE_LAYERS = ['CTR', 'TIZ', 'ATZ', 'RSTA', 'DNGA'] as const;

/**
 * Sweden needs two upstreams. Transportstyrelsen's ED-318 file holds only the 62 zones it has
 * designated under Article 15; the controlled airspace a Swedish pilot also needs permission
 * for — control zones, traffic information zones, restricted and danger areas — lives in LFV's
 * WFS, and LFV has confirmed it will never ship those as ED-318. Publishing the ED-318 file on
 * its own would answer "no zones here" next to Arlanda, so the two are fetched together and
 * carried through the pipeline as one payload.
 */
export async function fetchZones(): Promise<{
  raw: string;
  sourceUrl: string;
  publishedAt: string;
}> {
  const ed318 = await request(ED318_URL).then((r) => {
    if (!r.ok) throw new Error(`ED-318 download returned ${r.status}`);
    return r.json();
  });

  const airspace: Record<string, { features?: { properties?: Record<string, unknown> }[] }> = {};
  for (const layer of AIRSPACE_LAYERS) {
    const url =
      `${WFS}?service=WFS&version=2.0.0&request=GetFeature` +
      `&typeNames=mais:${layer}&outputFormat=application/json&srsName=EPSG:4326`;
    airspace[layer] = await request(url).then((r) => {
      if (!r.ok) throw new Error(`${layer} download returned ${r.status}`);
      return r.json();
    });
  }

  return {
    raw: JSON.stringify({ ed318, airspace }),
    sourceUrl: ED318_URL,
    publishedAt: publishedAtFrom({ ed318, airspace }),
  };
}

/**
 * The ED-318 file states its own issue date; the WFS states an AIRAC effective date per
 * feature. Either upstream can move on its own, so the later of the two is the release.
 */
export function publishedAtFrom(payload: {
  ed318?: { metadata?: { issued?: string } };
  airspace?: Record<string, { features?: { properties?: Record<string, unknown> }[] }>;
}): string {
  let newest = String(payload.ed318?.metadata?.issued ?? '').slice(0, 10);
  for (const collection of Object.values(payload.airspace ?? {})) {
    for (const feature of collection.features ?? []) {
      const wef = feature.properties?.['WEF'];
      if (typeof wef === 'string' && wef.slice(0, 10) > newest) newest = wef.slice(0, 10);
    }
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(newest)) throw new Error('no issue date on either upstream');
  return newest;
}
