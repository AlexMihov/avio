import type { SourceManifest } from '../../shared/source';

export const manifest: SourceManifest = {
  id: 'ireland',
  names: { en: 'Ireland', de: 'Irland', pt: 'Irlanda', fr: 'Irlande', it: 'Irlanda', bg: 'Ирландия' },
  sourceLocale: 'en',
  officialUrl: 'https://www.iaa.ie/general-aviation/drones/uas-geographic-zones',
  attribution: 'Irish Aviation Authority (IAA)',
  disclaimer: {
    en: 'Unofficial. Always verify against the official IAA publication before flying.',
    de: 'Inoffiziell. Vor dem Flug immer die offizielle IAA-Publikation prüfen.',
  },
  defaultView: { center: [53.4, -8.0], zoom: 7 },
};
