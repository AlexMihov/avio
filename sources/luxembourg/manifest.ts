import type { SourceManifest } from '../../shared/source';

export const manifest: SourceManifest = {
  id: 'luxembourg',
  names: { en: 'Luxembourg', de: 'Luxemburg', fr: 'Luxembourg', bg: 'Люксембург', pt: 'Luxemburgo' },
  // The DAC publishes its zone texts in English, not in a national language.
  sourceLocale: 'en',
  officialUrl: 'https://dac.gouvernement.lu/en/drones/geozones.html',
  attribution: "Direction de l'Aviation Civile (DAC Luxembourg) — data.public.lu, CC0",
  disclaimer: {
    en: 'Unofficial. Always verify against the official DAC publication before flying.',
    fr: "Non officiel. Toujours vérifier la publication officielle de la DAC avant de voler.",
    de: 'Inoffiziell. Vor dem Flug immer die offizielle DAC-Publikation prüfen.',
  },
  defaultView: { center: [49.8153, 6.1296], zoom: 10 },
};
