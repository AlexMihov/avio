import { manifest as bulgaria } from './bulgaria/manifest';
import { fetchZones as bulgariaFetch } from './bulgaria/fetch';
import { normalize as bulgariaNormalize } from './bulgaria/normalize';
export const CONNECTORS = {
    bulgaria: {
        manifest: bulgaria,
        fetch: bulgariaFetch,
        normalize: bulgariaNormalize,
    },
};
