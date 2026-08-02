# Avio

Official UAS geographical zones on a map you can actually use. Pick a point, enter the
height you intend to fly at, and see every zone that applies — with the authority's own
text, the vertical limits, and who to contact for permission.

Bulgaria was the first source, because the Civil Aviation Administration publishes the data
as an ED-269 JSON file but offers no usable public map. Switzerland followed.

**This is an unofficial tool. Always verify against the official publication before flying.**

## How it works

There is no backend. A scheduled GitHub Action fetches each authority's file, normalizes it
and commits the result as static JSON; the browser loads that file and does every
containment and altitude calculation locally.

```
GitHub Action (daily)                     Browser
  sources/<id>/fetch.ts      ─┐
  sources/<id>/normalize.ts   ├─► public/data/<id>/zones.json ──► map + query
  tools/build-data.ts        ─┘                      meta.json ──► freshness banner
```

Fetching happens in CI rather than in the browser because authority sites generally send no
CORS headers, publish zips rather than JSON, and put the release date in the file name.

## Running it locally

Requires Node 24 (Angular 22 needs ≥ 22.22.3). On NixOS, `nix develop` provides it.

```bash
npm ci
npm run data     # fetch and normalize the enabled sources
npx ng serve     # http://localhost:4200
npm test         # normalizer, geometry, query, config and permalink tests
```

## Configuration

`config/app.config.json` is loaded at runtime, so anyone hosting this can change it without
rebuilding:

```json
{
  "enabledSources": ["bulgaria", "luxembourg", "portugal", "switzerland"],
  "defaultSources": ["switzerland"],
  "map": { "tileUrl": "...", "attribution": "...", "maxZoom": 19 },
  "defaultHeightM": 120,
  "staleAfterDays": 7
}
```

`tools/build-data.ts` reads the same file, so enabling a source turns on both its data build
and its entry in the UI. `defaultSources` is what a first visit selects; visitors can tick any
combination of the enabled sources, and the selection travels in the address bar as
`?src=switzerland,bulgaria`. Every selected source is queried at once, so a point near a
border returns the zones of both countries.

If `map.tileUrl` contains `{lang}`, it is filled with the active UI locale and the basemap is
relaid when the language changes. The default CARTO basemap ignores language and is served
without it; localised labels need a provider that supports them.

## Self-hosting

Fork, enable GitHub Pages with "GitHub Actions" as the source, and push. The deploy workflow
builds and publishes; the refresh workflow keeps `public/data` up to date and commits only
when the authority actually changes something.

## Adding a country

See [docs/adding-a-source.md](docs/adding-a-source.md). A source is one directory with a
manifest, a fetcher, a normalizer and a fixture-backed test — no changes to the app itself.

## Sharing a query

The address bar always reflects the current query, including which countries are selected and
which language it is being read in: `?at=38.7223,-9.1393&h=50&src=portugal&lang=pt`. A shared
link's language wins over the recipient's stored preference — the sender chose the language
the link should be read in. An unknown `lang` falls back to the stored choice, then the
browser, then English.

## Data and attribution

Bulgaria: ГД "Гражданска въздухоплавателна администрация" —
[UAS geographical zones](https://www.caa.bg/bg/category/633/7062). Zone texts are shown in
the original Bulgarian, which is authoritative; English is an unofficial translation.

Luxembourg: Direction de l'Aviation Civile —
[UAS geographical zones](https://data.public.lu/en/datasets/uas-geographical-zones-grand-duchy-of-luxembourg-zones-geographiques-uas-grand-duche-de-luxembourg/),
ED-269 under CC0. The DAC gives every zone a validity window rather than marking any of them
permanent, and regenerates the file per request, so the airport zones carry that day's
operating hours. The build warns when a large share of a source is about to lapse.

Portugal: Autoridade Nacional da Aviação Civil (ANAC) —
[UAS geographical zones](https://dnt.anac.pt/mapa.html). ANAC serves its ED-269 document as
the data file of its own map viewer, writes both Portuguese and English into one message
field, and states three nature-reserve ceilings in feet, which the build converts. **The terms of reuse
are unconfirmed — ANAC has been asked and has not yet replied.**

Switzerland: Federal Office of Civil Aviation (BAZL/FOCA) —
[Geographical UAS zones of Switzerland](https://opendata.swiss/en/dataset/geografische-uas-gebiete-der-schweiz),
published as ED-269 via the geo.admin.ch STAC API under Opendata BY, which requires the
source to be named. The ED-269 file carries English text only; the GeoPackage in the same
release carries FOCA's own German, French and Italian wording, so the build reads both and
joins them on the zone identifier. All four languages are the authority's, none is a
translation of ours, and the strip labels them accordingly.

Basemap © OpenStreetMap contributors, © CARTO.
