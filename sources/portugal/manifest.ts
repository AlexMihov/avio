import type { SourceManifest } from '../../shared/source';

export const manifest: SourceManifest = {
  id: 'portugal',
  names: { en: 'Portugal', de: 'Portugal', fr: 'Portugal', bg: 'Португалия', pt: 'Portugal' },
  sourceLocale: 'pt',
  // ANAC writes each message in Portuguese and English, in one field, so both are its own.
  officialLocales: ['pt', 'en'],
  officialUrl: 'https://dnt.anac.pt/mapa.html',
  attribution: 'Autoridade Nacional da Aviação Civil (ANAC Portugal)',
  disclaimer: {
    en: 'Unofficial. Always verify against the official ANAC publication before flying.',
    de: 'Inoffiziell. Vor dem Flug immer die offizielle ANAC-Publikation prüfen.',
  },
  defaultView: { center: [39.5, -8.0], zoom: 7 },
};
