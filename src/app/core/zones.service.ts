import { Injectable, signal } from '@angular/core';
import type { SourceManifest } from '../../../shared/source';
import type { NormalizedZone, SourceMeta } from '../../../shared/zone';

interface Loaded {
  zones: NormalizedZone[];
  meta: SourceMeta;
}

/** Loads the mirrored, pre-normalized data for the selected sources. */
@Injectable({ providedIn: 'root' })
export class ZonesService {
  readonly manifests = signal<SourceManifest[]>([]);
  readonly activeIds = signal<string[]>([]);
  readonly zones = signal<NormalizedZone[]>([]);
  readonly metas = signal<Record<string, SourceMeta>>({});
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  /** A source stays in memory once fetched, so toggling it back on costs nothing. */
  private readonly cache = new Map<string, Loaded>();

  async loadManifests(): Promise<void> {
    const res = await fetch('data/index.json');
    if (!res.ok) throw new Error(`data/index.json returned ${res.status}`);
    this.manifests.set(await res.json());
  }

  manifest(id: string | null): SourceManifest | undefined {
    return this.manifests().find((m) => m.id === id);
  }

  async select(sourceIds: string[]): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    const results = await Promise.allSettled(sourceIds.map((id) => this.load(id)));
    const failures: string[] = [];
    const zones: NormalizedZone[] = [];
    const metas: Record<string, SourceMeta> = {};
    const loaded: string[] = [];

    // One unreachable source must not blank out the others; it is reported and dropped.
    for (const [i, result] of results.entries()) {
      const id = sourceIds[i];
      if (result.status === 'fulfilled') {
        zones.push(...result.value.zones);
        metas[id] = result.value.meta;
        loaded.push(id);
      } else {
        failures.push(`${id}: ${result.reason instanceof Error ? result.reason.message : result.reason}`);
      }
    }

    this.zones.set(zones);
    this.metas.set(metas);
    this.activeIds.set(loaded);
    this.error.set(failures.length ? failures.join('; ') : null);
    this.loading.set(false);
  }

  private async load(sourceId: string): Promise<Loaded> {
    const cached = this.cache.get(sourceId);
    if (cached) return cached;

    const [zones, meta] = await Promise.all([
      fetchJson<NormalizedZone[]>(`data/${sourceId}/zones.json`),
      fetchJson<SourceMeta>(`data/${sourceId}/meta.json`),
    ]);
    const entry = { zones, meta };
    this.cache.set(sourceId, entry);
    return entry;
  }
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} returned ${res.status}`);
  return res.json() as Promise<T>;
}
