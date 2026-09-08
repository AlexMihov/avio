import type { SourceManifest } from '../../shared/source';

export const manifest: SourceManifest = {
  id: 'sweden',
  names: { en: 'Sweden', de: 'Schweden', fr: 'Suède', it: 'Svezia', pt: 'Suécia', bg: 'Швеция' },
  // Transportstyrelsen writes every designated zone in Swedish and English, and LFV writes the
  // airspace remarks in both as well, so neither is a translation of ours.
  sourceLocale: 'sv',
  officialLocales: ['sv', 'en'],
  officialUrl: 'https://daim.lfv.se/echarts/dronechart/',
  attribution: 'Transportstyrelsen and Luftfartsverket (LFV) — DAIM Dronechart, CC BY 4.0',
  disclaimer: {
    en: 'Unofficial. Always verify against the official Dronechart publication before flying.',
    de: 'Inoffiziell. Vor dem Flug immer die offizielle Dronechart-Publikation prüfen.',
  },
  defaultView: { center: [62.5, 16.5], zoom: 5 },
};
