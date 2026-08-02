import type { SourceManifest } from '../../shared/source';

export const manifest: SourceManifest = {
  id: 'switzerland',
  names: { en: 'Switzerland', de: 'Schweiz', fr: 'Suisse', it: 'Svizzera', pt: 'Suíça' },
  // The machine-readable ED-269 file is English; the same release carries FOCA's own DE, FR
  // and IT wording, so all four are the authority's text rather than our translation.
  sourceLocale: 'en',
  officialLocales: ['de', 'fr', 'it', 'en'],
  officialUrl:
    'https://www.bazl.admin.ch/bazl/en/home/gutzuwissen/drohnen-und-flugmodelle.html',
  attribution: 'Federal Office of Civil Aviation (FOCA/BAZL) — opendata.swiss, Opendata BY',
  disclaimer: {
    en: 'Unofficial. Always verify against the official FOCA publication before flying.',
    de: 'Inoffiziell. Vor dem Flug immer die offizielle BAZL-Publikation prüfen.',
    fr: "Non officiel. Toujours vérifier la publication officielle de l'OFAC avant de voler.",
  },
  defaultView: { center: [46.8182, 8.2275], zoom: 8 },
};
