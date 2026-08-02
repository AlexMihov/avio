import type { SourceManifest } from '../../shared/source';

export const manifest: SourceManifest = {
  id: 'estonia',
  names: { en: 'Estonia', de: 'Estland', pt: 'Estónia', fr: 'Estonie', it: 'Estonia', bg: 'Естония' },
  sourceLocale: 'et',
  // EANS publishes each message in Estonian and English, so both are the authority's own.
  officialLocales: ['et', 'en'],
  officialUrl:
    'https://transpordiamet.ee/en/aviation-and-aviation-safety/flying-drones-estonia/geographical-zones',
  attribution: 'Transpordiamet / EANS (Estonian Transport Administration)',
  disclaimer: {
    en: 'Unofficial. Always verify against the official Transpordiamet publication before flying.',
    de: 'Inoffiziell. Vor dem Flug immer die offizielle Transpordiamet-Publikation prüfen.',
  },
  defaultView: { center: [58.7, 25.5], zoom: 7 },
};
