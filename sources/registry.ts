import type { SourceManifest } from '../shared/source';
import type { NormalizedZone } from '../shared/zone';

import { manifest as bulgaria } from './bulgaria/manifest';
import { fetchZones as bulgariaFetch } from './bulgaria/fetch';
import { normalize as bulgariaNormalize } from './bulgaria/normalize';

export interface Connector {
  manifest: SourceManifest;
  /** Node-side only: may scrape, download and unpack whatever the authority publishes. */
  fetch(): Promise<{ raw: string; sourceUrl: string; publishedAt: string }>;
  /** Pure and deterministic, so it can be tested against a committed fixture. */
  normalize(raw: string): { zones: NormalizedZone[]; warnings: string[] };
}

export const CONNECTORS: Record<string, Connector> = {
  bulgaria: {
    manifest: bulgaria,
    fetch: bulgariaFetch,
    normalize: bulgariaNormalize,
  },
};
