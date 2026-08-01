import { __decorate } from "tslib";
import { Injectable, signal } from '@angular/core';
/** Loads the mirrored, pre-normalized data for one source. */
let ZonesService = class ZonesService {
    manifests = signal([]);
    activeId = signal(null);
    zones = signal([]);
    meta = signal(null);
    loading = signal(false);
    error = signal(null);
    async loadManifests() {
        const res = await fetch('data/index.json');
        if (!res.ok)
            throw new Error(`data/index.json returned ${res.status}`);
        this.manifests.set(await res.json());
    }
    manifest(id) {
        return this.manifests().find((m) => m.id === id);
    }
    async select(sourceId) {
        this.loading.set(true);
        this.error.set(null);
        try {
            const [zones, meta] = await Promise.all([
                fetchJson(`data/${sourceId}/zones.json`),
                fetchJson(`data/${sourceId}/meta.json`),
            ]);
            this.zones.set(zones);
            this.meta.set(meta);
            this.activeId.set(sourceId);
        }
        catch (e) {
            this.error.set(e instanceof Error ? e.message : String(e));
            this.zones.set([]);
            this.meta.set(null);
        }
        finally {
            this.loading.set(false);
        }
    }
};
ZonesService = __decorate([
    Injectable({ providedIn: 'root' })
], ZonesService);
export { ZonesService };
async function fetchJson(url) {
    const res = await fetch(url);
    if (!res.ok)
        throw new Error(`${url} returned ${res.status}`);
    return res.json();
}
