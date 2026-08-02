import type { SourceManifest } from '../shared/source';
import type { NormalizedZone } from '../shared/zone';

import { manifest as bulgaria } from './bulgaria/manifest';
import { fetchZones as bulgariaFetch } from './bulgaria/fetch';
import { normalize as bulgariaNormalize } from './bulgaria/normalize';
import { manifest as luxembourg } from './luxembourg/manifest';
import { fetchZones as luxembourgFetch } from './luxembourg/fetch';
import { normalize as luxembourgNormalize } from './luxembourg/normalize';
import { manifest as portugal } from './portugal/manifest';
import { fetchZones as portugalFetch } from './portugal/fetch';
import { normalize as portugalNormalize } from './portugal/normalize';
import { manifest as switzerland } from './switzerland/manifest';
import { fetchZones as switzerlandFetch } from './switzerland/fetch';
import { normalize as switzerlandNormalize } from './switzerland/normalize';

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
  luxembourg: {
    manifest: luxembourg,
    fetch: luxembourgFetch,
    normalize: luxembourgNormalize,
  },
  portugal: {
    manifest: portugal,
    fetch: portugalFetch,
    normalize: portugalNormalize,
  },
  switzerland: {
    manifest: switzerland,
    fetch: switzerlandFetch,
    normalize: switzerlandNormalize,
  },
};
