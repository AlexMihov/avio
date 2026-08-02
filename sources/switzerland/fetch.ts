import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const STAC_ITEMS =
  'https://data.geo.admin.ch/api/stac/v1/collections/ch.bazl.einschraenkungen-drohnen/items';

/** The WGS84 ED-269 asset: structure, geometry and vertical limits. English text only. */
const ZONES_ASSET = 'einschraenkungen-drohnen_4326.json';

/**
 * The GeoPackage carries the same release with the text in all four national languages. Its
 * geometry is LV95 and we never read it — only the string columns, joined on Identifier.
 */
const TEXTS_ASSET = 'einschraenkungen-drohnen_2056.gpkg';

const TABLE = 'SwissUASGeozones_LV95';
const LOCALES = ['de', 'fr', 'it', 'en'] as const;

export interface SwissTexts {
  name: Record<string, string>;
  message: Record<string, string>;
  condition: Record<string, string>;
  authority: Record<string, string>;
}

function assetHref(item: { assets: Record<string, { href?: string }> }, name: string): string {
  const href = item.assets?.[name]?.href;
  if (!href) throw new Error(`STAC item has no "${name}" asset`);
  return href;
}

function byLocale(row: Record<string, unknown>, column: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const locale of LOCALES) {
    const value = row[`${column}_${locale}`];
    if (typeof value === 'string' && value.trim()) out[locale] = value.trim();
  }
  return out;
}

/** Pulls the multilingual columns out of the GeoPackage, keyed by zone identifier. */
function readTexts(gpkg: ArrayBuffer): Record<string, SwissTexts> {
  const dir = mkdtempSync(join(tmpdir(), 'avio-che-'));
  const path = join(dir, 'zones.gpkg');
  try {
    writeFileSync(path, Buffer.from(gpkg));
    const db = new DatabaseSync(path, { readOnly: true });
    const columns = [
      'Identifier',
      ...LOCALES.flatMap((l) => [`Name_${l}`, `Message_${l}`, `Restriction_${l}`, `Authority_${l}`]),
    ];
    const rows = db.prepare(`SELECT ${columns.join(', ')} FROM ${TABLE}`).all() as Record<
      string,
      unknown
    >[];
    db.close();

    const texts: Record<string, SwissTexts> = {};
    for (const row of rows) {
      const id = String(row['Identifier']);
      texts[id] = {
        name: byLocale(row, 'Name'),
        message: byLocale(row, 'Message'),
        condition: byLocale(row, 'Restriction'),
        authority: byLocale(row, 'Authority'),
      };
    }
    return texts;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * FOCA republishes the same asset URLs on every update, so the release date has to come from
 * the STAC item's datetime rather than from a file name. Going through the STAC API also
 * means a changed asset path surfaces as a build failure instead of a stale download.
 */
export async function fetchZones(): Promise<{
  raw: string;
  sourceUrl: string;
  publishedAt: string;
}> {
  const items = await fetch(STAC_ITEMS).then((r) => {
    if (!r.ok) throw new Error(`STAC items returned ${r.status}`);
    return r.json();
  });

  const item = (items.features ?? []).find((f: { assets?: Record<string, unknown> }) =>
    Boolean(f.assets?.[ZONES_ASSET]),
  );
  if (!item) throw new Error(`no STAC item exposes the "${ZONES_ASSET}" asset`);

  const datetime: string | undefined = item.properties?.datetime;
  if (!datetime) throw new Error('STAC item has no properties.datetime');

  const sourceUrl = assetHref(item, ZONES_ASSET);
  const [ed269, gpkg] = await Promise.all([
    fetch(sourceUrl).then((r) => {
      if (!r.ok) throw new Error(`zone download returned ${r.status}`);
      return r.json();
    }),
    fetch(assetHref(item, TEXTS_ASSET)).then((r) => {
      if (!r.ok) throw new Error(`geopackage download returned ${r.status}`);
      return r.arrayBuffer();
    }),
  ]);

  // The two assets are joined here rather than in normalize, which stays pure and testable.
  return {
    raw: JSON.stringify({ ed269, texts: readTexts(gpkg) }),
    sourceUrl,
    publishedAt: datetime.slice(0, 10),
  };
}
