<h1 align="center">Avio</h1>

<p align="center">
  <strong>Official UAS geographical zones on a map you can actually use.</strong><br/>
  Pick a point, enter the height you intend to fly at, and see every zone that applies —
  with the authority's own text, the vertical limits, and who to contact for permission.
</p>

<p align="center">
  <a href="https://alexmihov.github.io/avio/"><strong>Open the map →</strong></a>
</p>

<p align="center">
  <a href="https://github.com/AlexMihov/avio/actions/workflows/deploy.yml"><img alt="Deploy" src="https://github.com/AlexMihov/avio/actions/workflows/deploy.yml/badge.svg"></a>
  <a href="https://github.com/AlexMihov/avio/actions/workflows/refresh-data.yml"><img alt="Zone data refresh" src="https://github.com/AlexMihov/avio/actions/workflows/refresh-data.yml/badge.svg"></a>
  <img alt="Zones" src="https://img.shields.io/badge/zones-3%2C378-0b7285">
  <img alt="Countries" src="https://img.shields.io/badge/countries-8-0b7285">
  <img alt="Languages" src="https://img.shields.io/badge/languages-6-0b7285">
  <a href="LICENSE"><img alt="License: CC BY-NC 4.0" src="https://img.shields.io/badge/license-CC%20BY--NC%204.0-blue"></a>
</p>

> [!WARNING]
> **This is an unofficial tool. Always verify against the official publication before flying.**

> [!NOTE]
> Free for non-commercial use under [CC BY-NC 4.0](LICENSE) — credit Alex Mihov and link back.
> For commercial use, get in touch.

## Coverage

| Country        | Authority                      | Published as                      | Zones |
| -------------- | ------------------------------ | --------------------------------- | ----: |
| 🇧🇬 Bulgaria    | ГД ГВА                         | ED-269, zip behind a scraped link |   881 |
| 🇨🇾 Cyprus      | Τμήμα Πολιτικής Αεροπορίας     | ED-269, date-stamped file         |   141 |
| 🇪🇪 Estonia     | Transpordiamet / EANS          | GeoJSON with ED-269 properties    |   245 |
| 🇮🇪 Ireland     | Irish Aviation Authority       | GeoJSON, ED-269 semantics         |    87 |
| 🇱🇺 Luxembourg  | Direction de l'Aviation Civile | ED-269, CC0                       |    47 |
| 🇵🇹 Portugal    | ANAC                           | ED-269 behind a map viewer        |   385 |
| 🇸🇪 Sweden      | Transportstyrelsen + LFV       | ED-318 **and** a WFS              |   298 |
| 🇨🇭 Switzerland | BAZL / FOCA                    | ED-269 + GeoPackage, via STAC     | 1,294 |

Eight authorities, six wire formats, one zone model. The interface reads in English, German,
French, Italian, Portuguese and Bulgarian, and every zone keeps the authority's own wording
alongside it.

Bulgaria was the first source, because the Civil Aviation Administration publishes the data
as an ED-269 JSON file but offers no usable public map. Switzerland followed.

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
  "enabledSources": [
    "bulgaria",
    "cyprus",
    "estonia",
    "ireland",
    "luxembourg",
    "portugal",
    "sweden",
    "switzerland"
  ],
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

`analytics.measurementId` takes a Google Analytics 4 id (`G-XXXXXXXXXX`). It is empty in this
repository and stays that way: the deploy workflow writes the id in from the repository
variable `GA_MEASUREMENT_ID`, so a fork builds with analytics off rather than reporting its
visitors into someone else's property. To measure your own deployment, set that variable
under Settings → Secrets and variables → Actions → Variables; to run analytics locally, put
the id straight into this file and do not commit it.

With an id set, the tag is loaded only after the visitor accepts, and `page_location` and
`page_referrer` are overridden to the bare page, so the query string — the point and height
being checked — never reaches Google. Declining loads nothing from Google at all.

**One setting has to be changed in Google Analytics itself.** Enhanced measurement raises its
own `page_view` whenever the address bar changes, reading `location.href` directly, and no
value passed to `gtag` overrides it. Since this app keeps the query in the address bar, that
event would carry the coordinates. Turn it off under Admin → Data streams → _your stream_ →
Enhanced measurement → the gear icon → uncheck **Page changes based on browser history
events**. The app sends its own sanitised `page_view` instead, so nothing is lost.

Each query also sends one `zone_query` event carrying the countries selected, the interface
language, whether anything applied, and the position rounded to a tenth of a degree — around
11 km, enough for "people are checking around Zürich" and not enough to identify a site.

If `map.tileUrl` contains `{lang}`, it is filled with the active UI locale and the basemap is
relaid when the language changes. The default OpenStreetMap basemap ignores language and is
served without it; localised labels need a provider that supports them.

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

Cyprus: Τμήμα Πολιτικής Αεροπορίας (Department of Civil Aviation) —
[UAS geographical zones](https://drones.gov.cy/geo-zones-file/). Textbook ED-269 from a
date-stamped file linked off the geo-zones page. Zone texts are Greek, which is
authoritative; the English is a curated translation, as with Bulgaria.

Estonia: Transpordiamet / EANS —
[geographical zones](https://transpordiamet.ee/en/aviation-and-aviation-safety/flying-drones-estonia/geographical-zones).
GeoJSON whose properties carry the ED-269 fields, with Estonian and English both published by
EANS. Their "Outside Estonia" record spans the whole globe with the country as a hole; it is
an out-of-jurisdiction notice rather than a zone, and the build drops it with a warning.

Ireland: Irish Aviation Authority —
[UAS geographic zones](https://www.iaa.ie/general-aviation/drones/uas-geographic-zones).
GeoJSON with ED-269 semantics; the IAA publishes no vertical limits at all, so every Irish
zone is ground to unlimited, and a few carry several applicability windows that the model
records as a condition rather than collapsing.

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

Sweden: Transportstyrelsen and Luftfartsverket (LFV) —
[Dronechart](https://daim.lfv.se/echarts/dronechart/), CC BY 4.0. The only source that needs
two upstreams. Transportstyrelsen publishes 62 Article 15 zones as ED-318, bilingual and
well-formed, but the controlled airspace a Swedish pilot also needs permission for is not in
it, and LFV has confirmed it never will be: control zones, traffic information zones,
aerodrome traffic zones, restricted areas and danger areas come from LFV's WFS instead, and
converting them is left to the reader. Publishing the ED-318 file alone would answer "no zones
here" next to Arlanda, so the build fetches both and merges them.

Following LFV's own drone chart, an area is kept when its floor is at or below 500 ft above
sea level; limits are published in feet and converted. The WFS carries no remark for a
control, traffic information or traffic zone, so the build reproduces the standing rule LFV's
chart states for each — including the drop from 50 m to 10 m in the control zones with heavy
military traffic — in LFV's own Swedish and English. Areas across the border that appear in
the Swedish AIP are left to their own country.

Switzerland: Federal Office of Civil Aviation (BAZL/FOCA) —
[Geographical UAS zones of Switzerland](https://opendata.swiss/en/dataset/geografische-uas-gebiete-der-schweiz),
published as ED-269 via the geo.admin.ch STAC API under Opendata BY, which requires the
source to be named. The ED-269 file carries English text only; the GeoPackage in the same
release carries FOCA's own German, French and Italian wording, so the build reads both and
joins them on the zone identifier. All four languages are the authority's, none is a
translation of ours, and the strip labels them accordingly.

Basemap © OpenStreetMap contributors.

## Licence

The code is [CC BY-NC 4.0](LICENSE): use it, fork it, run your own copy — for anything
non-commercial, and name Alex Mihov with a link back to this repository. For commercial use,
ask.

The zone data is a separate matter and is not mine to license. Each authority's terms travel
with its data — CC BY 4.0, CC0, Opendata BY — and every source is credited above. Portugal's
terms are still unconfirmed.
