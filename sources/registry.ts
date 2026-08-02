import type { SourceManifest } from '../shared/source';
import type { NormalizedZone } from '../shared/zone';

import { manifest as bulgaria } from './bulgaria/manifest';
import { fetchZones as bulgariaFetch } from './bulgaria/fetch';
import { normalize as bulgariaNormalize } from './bulgaria/normalize';
import { manifest as cyprus } from './cyprus/manifest';
import { fetchZones as cyprusFetch } from './cyprus/fetch';
import { normalize as cyprusNormalize } from './cyprus/normalize';
import { manifest as estonia } from './estonia/manifest';
import { fetchZones as estoniaFetch } from './estonia/fetch';
import { normalize as estoniaNormalize } from './estonia/normalize';
import { manifest as ireland } from './ireland/manifest';
import { fetchZones as irelandFetch } from './ireland/fetch';
import { normalize as irelandNormalize } from './ireland/normalize';
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
  cyprus: { manifest: cyprus, fetch: cyprusFetch, normalize: cyprusNormalize },
  estonia: { manifest: estonia, fetch: estoniaFetch, normalize: estoniaNormalize },
  ireland: { manifest: ireland, fetch: irelandFetch, normalize: irelandNormalize },
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
