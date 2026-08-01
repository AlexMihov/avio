/** `?at=<lat>,<lon>&h=<metres>&src=<sourceId>` — so a pilot can send someone the exact query. */
export function parsePermalink(search) {
    const params = new URLSearchParams(search);
    const at = params.get('at');
    const h = params.get('h');
    let point = null;
    if (at) {
        const [lat, lon] = at.split(',').map(Number);
        if (Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
            point = [lon, lat];
        }
    }
    const heightM = h !== null && Number.isFinite(Number(h)) ? Number(h) : null;
    return { point, heightM, source: params.get('src') };
}
export function buildPermalink(state) {
    const params = new URLSearchParams();
    if (state.point) {
        params.set('at', `${state.point[1].toFixed(5)},${state.point[0].toFixed(5)}`);
    }
    if (state.heightM !== null)
        params.set('h', String(state.heightM));
    if (state.source)
        params.set('src', state.source);
    // A comma is legal in a query string and keeps shared links readable.
    const query = params.toString().replace(/%2C/g, ',');
    return query ? `?${query}` : location.pathname;
}
