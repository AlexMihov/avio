import type { SourceManifest } from '../../shared/source';

export const manifest: SourceManifest = {
  id: 'bulgaria',
  names: { en: 'Bulgaria', bg: 'България', de: 'Bulgarien' },
  sourceLocale: 'bg',
  officialUrl: 'https://www.caa.bg/bg/category/633/7062',
  attribution: 'ГД "Гражданска въздухоплавателна администрация" (CAA Bulgaria)',
  disclaimer: {
    en: 'Unofficial. Always verify against the official CAA publication before flying.',
    bg: 'Неофициално. Винаги проверявайте официалната публикация на ГД ГВА преди полет.',
  },
  defaultView: { center: [42.7339, 25.4858], zoom: 7 },
};
