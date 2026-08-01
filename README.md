# Drone Zones

Official UAS geographical zones on a map you can actually use. Pick a point, enter the
height you intend to fly at, and see every zone that applies — with the authority's own
text, the vertical limits, and who to contact for permission.

Bulgaria is the first source, because the Civil Aviation Administration publishes the data
as an ED-269 JSON file but offers no usable public map.

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
  "enabledSources": ["bulgaria"],
  "defaultSource": "bulgaria",
  "map": { "tileUrl": "...", "attribution": "...", "maxZoom": 19 },
  "defaultHeightM": 120,
  "staleAfterDays": 7
}
```

`tools/build-data.ts` reads the same file, so enabling a source turns on both its data build
and its entry in the UI.

## Self-hosting

Fork, enable GitHub Pages with "GitHub Actions" as the source, and push. The deploy workflow
builds and publishes; the refresh workflow keeps `public/data` up to date and commits only
when the authority actually changes something.

## Adding a country

See [docs/adding-a-source.md](docs/adding-a-source.md). A source is one directory with a
manifest, a fetcher, a normalizer and a fixture-backed test — no changes to the app itself.

## Sharing a query

The address bar always reflects the current query: `?at=42.6977,23.3219&h=50`.

## Data and attribution

Bulgaria: ГД "Гражданска въздухоплавателна администрация" —
[UAS geographical zones](https://www.caa.bg/bg/category/633/7062). Zone texts are shown in
the original Bulgarian, which is authoritative; English is an unofficial translation.

Basemap © OpenStreetMap contributors, © CARTO.
