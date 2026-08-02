import type { SourceManifest } from '../../shared/source';

export const manifest: SourceManifest = {
  id: 'cyprus',
  names: { en: 'Cyprus', de: 'Zypern', pt: 'Chipre', fr: 'Chypre', it: 'Cipro', bg: 'Кипър' },
  sourceLocale: 'el',
  officialUrl: 'https://drones.gov.cy/geo-zones-file/',
  attribution: 'Τμήμα Πολιτικής Αεροπορίας (Department of Civil Aviation, Cyprus)',
  disclaimer: {
    en: 'Unofficial. Always verify against the official DCA publication before flying.',
    de: 'Inoffiziell. Vor dem Flug immer die offizielle DCA-Publikation prüfen.',
  },
  defaultView: { center: [35.0, 33.2], zoom: 9 },
};
