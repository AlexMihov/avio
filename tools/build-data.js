import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { CONNECTORS } from '../sources/registry';
/** A jump this large means the authority changed something structural. Look before publishing. */
const MAX_ZONE_COUNT_DELTA = 0.2;
const config = JSON.parse(readFileSync('config/app.config.json', 'utf8'));
const manifests = [];
for (const id of config.enabledSources) {
    const connector = CONNECTORS[id];
    if (!connector) {
        throw new Error(`unknown source "${id}" in config/app.config.json; known: ${Object.keys(CONNECTORS).join(', ')}`);
    }
    const { raw, sourceUrl, publishedAt } = await connector.fetch();
    const { zones, warnings } = connector.normalize(raw);
    if (zones.length === 0)
        throw new Error(`${id}: normalizer produced no zones`);
    const dir = `public/data/${id}`;
    const metaPath = `${dir}/meta.json`;
    if (existsSync(metaPath)) {
        const prev = JSON.parse(readFileSync(metaPath, 'utf8'));
        const delta = Math.abs(zones.length - prev.zoneCount) / prev.zoneCount;
        if (delta > MAX_ZONE_COUNT_DELTA) {
            throw new Error(`${id}: zone count moved ${(delta * 100).toFixed(0)}% (${prev.zoneCount} -> ${zones.length}); ` +
                `refusing to publish, inspect the release manually`);
        }
    }
    const meta = {
        sourceId: id,
        sourceUrl,
        publishedAt,
        fetchedAt: new Date().toISOString(),
        zoneCount: zones.length,
        checksum: createHash('sha256').update(raw).digest('hex'),
        warnings,
    };
    mkdirSync(dir, { recursive: true });
    writeFileSync(`${dir}/zones.json`, JSON.stringify(zones));
    writeFileSync(metaPath, JSON.stringify(meta, null, 2) + '\n');
    manifests.push(connector.manifest);
    console.log(`${id}: ${zones.length} zones, ${warnings.length} warnings, published ${publishedAt}`);
    for (const w of warnings.slice(0, 10))
        console.log(`  warning: ${w}`);
    if (warnings.length > 10)
        console.log(`  ... and ${warnings.length - 10} more`);
}
mkdirSync('public/data', { recursive: true });
writeFileSync('public/data/index.json', JSON.stringify(manifests, null, 2) + '\n');
