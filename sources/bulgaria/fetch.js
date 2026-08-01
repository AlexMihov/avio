import JSZip from 'jszip';
import { manifest } from './manifest';
const ORIGIN = 'https://www.caa.bg';
/**
 * The CAA publishes a date-stamped zip (bgr_zones_DDMMYYYY.zip) linked from its
 * geographical-zones page, so the current URL has to be discovered rather than assumed.
 * The site sends no CORS headers, which is why this runs in CI and never in the browser.
 */
export async function fetchZones() {
    const page = await fetch(manifest.officialUrl).then((r) => {
        if (!r.ok)
            throw new Error(`index page returned ${r.status}`);
        return r.text();
    });
    const match = page.match(/href="([^"]*bgr_zones_(\d{2})(\d{2})(\d{4})\.zip)"/i);
    if (!match) {
        throw new Error('no bgr_zones_DDMMYYYY.zip link found on the CAA index page');
    }
    const [, href, dd, mm, yyyy] = match;
    const sourceUrl = href.startsWith('http') ? href : ORIGIN + href;
    const publishedAt = `${yyyy}-${mm}-${dd}`;
    const buf = await fetch(sourceUrl).then((r) => {
        if (!r.ok)
            throw new Error(`zip download returned ${r.status}`);
        return r.arrayBuffer();
    });
    const zip = await JSZip.loadAsync(buf);
    const entry = Object.keys(zip.files).find((n) => n.toLowerCase().endsWith('.json'));
    if (!entry)
        throw new Error('no .json entry inside the downloaded zip');
    return { raw: await zip.files[entry].async('string'), sourceUrl, publishedAt };
}
