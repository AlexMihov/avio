import { Injectable, signal } from '@angular/core';
import type { SourceManifest } from '../../../shared/source';
import type { NormalizedZone, SourceMeta } from '../../../shared/zone';

/** Loads the mirrored, pre-normalized data for one source. */
@Injectable({ providedIn: 'root' })
export class ZonesService {
  readonly manifests = signal<SourceManifest[]>([]);
  readonly activeId = signal<string | null>(null);
  readonly zones = signal<NormalizedZone[]>([]);
  readonly meta = signal<SourceMeta | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  async loadManifests(): Promise<void> {
    const res = await fetch('data/index.json');
    if (!res.ok) throw new Error(`data/index.json returned ${res.status}`);
    this.manifests.set(await res.json());
  }

  manifest(id: string | null): SourceManifest | undefined {
    return this.manifests().find((m) => m.id === id);
  }

  async select(sourceId: string): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const [zones, meta] = await Promise.all([
        fetchJson<NormalizedZone[]>(`data/${sourceId}/zones.json`),
        fetchJson<SourceMeta>(`data/${sourceId}/meta.json`),
      ]);
      this.zones.set(zones);
      this.meta.set(meta);
      this.activeId.set(sourceId);
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : String(e));
      this.zones.set([]);
      this.meta.set(null);
    } finally {
      this.loading.set(false);
    }
  }
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} returned ${res.status}`);
  return res.json() as Promise<T>;
}
