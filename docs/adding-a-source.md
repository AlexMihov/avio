# Adding a country

A source is a directory under `sources/` that exports three things. The Angular app never
imports it — it only reads the normalized JSON the build produces — so adding a country
touches no application code.

```
sources/<id>/
  manifest.ts        what the UI needs to know about the source
  fetch.ts           gets the authority's raw payload (Node only)
  normalize.ts       turns that payload into NormalizedZone[] (pure)
  normalize.spec.ts  runs against a committed fixture
  messages.en.json   translations of the authority's fixed phrases, if it publishes text
  __fixtures__/      one real release, committed
```

## 1. manifest.ts

```ts
import type { SourceManifest } from '../../shared/source';

export const manifest: SourceManifest = {
  id: 'switzerland',
  names: { en: 'Switzerland', de: 'Schweiz', fr: 'Suisse' },
  sourceLocale: 'de',
  officialUrl: 'https://…',
  attribution: 'FOCA / BAZL',
  disclaimer: {
    en: 'Unofficial. Always verify against the official publication before flying.',
  },
  defaultView: { center: [46.8, 8.23], zoom: 8 },
};
```

## 2. fetch.ts

Runs in CI with full Node capabilities: scrape the index page, follow a date-stamped link,
unzip, transcode. Return the raw payload as a string plus the URL and publication date you
found. Throw on anything unexpected — the build must fail rather than publish something it
does not understand.

```ts
export async function fetchZones(): Promise<{
  raw: string;
  sourceUrl: string;
  publishedAt: string; // ISO date
}>;
```

## 3. normalize.ts

Pure and deterministic:

```ts
export function normalize(raw: string): { zones: NormalizedZone[]; warnings: string[] };
```

`NormalizedZone` is defined in `shared/zone.ts`. The rules that matter:

- **Never approximate a circle as a polygon.** Keep `{ kind: 'circle', center, radiusM }` so
  containment stays exact.
- **Never merge or dissolve zones.** Overlaps are the interesting case and the UI shows each
  one separately.
- Compute `bbox` — the query prefilters on it before doing real geometry.
- Normalize enum casing and record anything you could not map in `warnings`, rather than
  dropping it silently. Warnings end up in `meta.json`.
- Altitudes are metres; set `reference` to `AGL` or `AMSL` as published, and add a warning if
  the source mixes references within one zone.
- Keep the authority's own text in `text.source` and put translations in
  `text.translations`. The original is always displayed and is the authoritative version.
- If the authority publishes its text in several languages itself, list them in the manifest's
  `officialLocales`. None of them is then labelled an unofficial translation. Switzerland does
  this: the ED-269 file is English, and the GeoPackage in the same release carries the German,
  French and Italian, joined on the identifier by `fetch.ts`.

Most European authorities publish ED-269, so `sources/bulgaria/normalize.ts` is usually the
right starting point — copy it and adjust field names.

## 4. Test it against a real file

Commit one real release under `__fixtures__/` and assert the things that would break
silently: total count, the distribution of restrictions, that circles survive with their
exact radius, that null texts are tolerated, and that a known zone comes out with the right
altitude window.

```bash
npx vitest run sources/<id>/normalize.spec.ts
```

## 5. Register and enable

`sources/registry.ts`:

```ts
export const CONNECTORS: Record<string, Connector> = {
  bulgaria: { manifest: bulgaria, fetch: bulgariaFetch, normalize: bulgariaNormalize },
  switzerland: { manifest: swiss, fetch: swissFetch, normalize: swissNormalize },
};
```

`config/app.config.json`:

```json
{ "enabledSources": ["bulgaria", "switzerland"] }
```

Then `npm run data`. The country switcher appears in the header as soon as more than one
source is enabled.
