# Born Into Change

Personalised lifetime climate visualisation. Shows a user how the climate of
their city has changed since their birth year, using real public climate
data plus an optional AI-generated narrative layer.

## Stack

- Vanilla JS + Chart.js (CDN, no build step, no npm, no framework)
- Single-file frontend: `index.html` (all CSS in `<style>`, all JS in
  `<script>` at the bottom)
- Cloudflare Pages for hosting, three Pages Functions for the API layer

## Deployment

- Cloudflare Pages → connect GitHub repo
- Output directory `/`. The frontend itself needs no build step, but
  **Build command must be set to `npm install`** (not left blank) — Pages
  skips dependency installation entirely if no build command is set, which
  breaks `/api/og`'s npm-bundled `satori`/`resvg`/`yoga-wasm-web` imports
  (confirmed: blank build command → no `node_modules` → bundling fails with
  "Could not resolve" / ENOENT errors at deploy time)
- Set env var `GROQ_API_KEY` in the Pages dashboard (Settings → Environment
  variables) — required for `/api/chat`

## API inventory

- Open-Meteo Geocoding: `geocoding-api.open-meteo.com/v1/search`
- Open-Meteo Historical Weather (ERA5 reanalysis, daily): `archive-api.open-meteo.com/v1/archive`
- NASA GISTEMP global anomaly CSV (proxied — see below): `data.giss.nasa.gov/gistemp/tabledata_v4/GLB.Ts+dSST.csv`
- NOAA Mauna Loa CO₂ annual mean: `gml.noaa.gov/webdata/ccgg/trends/co2/co2_annmean_mlo.txt`
- Groq (proxied, never called directly from the browser): `/api/chat` →
  `api.groq.com/openai/v1/chat/completions`

## Pages Functions

- `functions/api/chat.js` — Groq proxy. Reads `GROQ_API_KEY` from env,
  forwards `{ messages, model }`, defaults model to
  `llama-3.3-70b-versatile`. Returns Groq's JSON response. CORS: `*`.
- `functions/api/og.js` — Satori-based edge image generator. Stateless,
  takes `city`, `year`, and optional `winterWarming` / `summerWarming` /
  `co2` query params. Returns a 1200×627 PNG, `Cache-Control: public,
  max-age=86400`. CORS: `*`.
- `functions/api/gistemp.js` — proxies NASA's GISTEMP CSV. NASA's endpoint
  sends no CORS headers, so the browser can't fetch it directly; this
  function re-serves the same CSV with `Access-Control-Allow-Origin: *` and
  a 24h cache. (NOAA's CO₂ endpoint *does* send CORS headers, so it's
  fetched directly from the browser — no proxy needed there.)

## CSS system

All colours are CSS custom properties declared once in `:root`
(`--color-bg`, `--color-surface`, `--color-text-primary`,
`--color-text-secondary`, `--color-accent-warm`, `--color-accent-cool`,
`--color-border`). **No hardcoded hex values anywhere outside `:root`.** A
full visual identity (palette, type, spacing tokens, component style) will
be supplied in a future session — it should be a drop-in replacement of the
`:root` block plus targeted component-class tweaks, nothing structural.

## Data computation notes

- Seasonal means: Jan+Feb average = winter, Jul+Aug average = summer
- Warming delta: mean of the **last 5 available years** minus mean of the
  **first 5 years after birth year**, to smooth interannual noise
- Decade anomaly: mean temp for that decade minus mean temp of the
  birth-year's own decade (baseline)
- NASA GISTEMP CSV: skip rows until the first column is a 4-digit year; the
  annual mean is the `J-D` column
- NOAA CO₂ file: skip lines beginning with `#`; col 0 = year, col 1 = mean
  ppm

## Sharing architecture (stateless, no DB)

- City + birth year are encoded as URL params: `/?city=Basel&year=1975`
- `history.pushState` updates the URL once results are computed
- On load, if `city` and `year` params are present, the input form is
  skipped and the pipeline runs immediately
- `updateShareState()` rewrites the OG meta tags in `<head>` after stats are
  computed, including the stats themselves in the `og:image` URL (the OG
  endpoint is stateless and has no other way to get personalised numbers,
  since social-media bots crawl `og:image` without executing JS)
- "Share my climate" copies the current URL to the clipboard
- "Download card" composites a PNG client-side via Canvas and triggers a
  download — entirely separate from the server-rendered OG image

## Known quirks / gotchas

- `/api/og` is the one part of this project with real npm dependencies
  (`satori`, `yoga-wasm-web`, `@resvg/resvg-wasm` — see root `package.json`).
  It imports their `.wasm` files directly (`import wasm from
  "../../node_modules/.../foo.wasm"`); Cloudflare Pages' function bundler
  handles this natively. Cloudflare Pages must run `npm install` during the
  build for this to work — set Build command to `npm install` in project
  settings (see Deployment above). The frontend itself still has zero build
  step.
- Dynamic `import("https://esm.sh/...")` at runtime was tried as an
  alternative to npm bundling (to dodge the build-command requirement) and
  **does not work reliably** — it failed consistently under a clean
  `wrangler pages dev` with "No such module" even though `fetch()` to the
  same URL succeeds. Don't reintroduce this pattern; use the npm imports.
- `climate-api.open-meteo.com/v1/climate` (with `models=ERA5`) does **not**
  work — that endpoint is for CMIP6 climate-projection models, not ERA5
  reanalysis, and rejects `ERA5` as an invalid model value. The actual ERA5
  historical reanalysis lives on `archive-api.open-meteo.com/v1/archive`,
  which only returns **daily** values (no native monthly aggregation) — the
  frontend's `fetchLocalClimate()` averages daily temps into monthly means
  client-side before handing off to `computeSeasonalSeries()`.
- The archive API returns full 50-year daily ranges in roughly a second in
  practice, but the loading screen's sequential status messages should
  still account for slower connections.
- LinkedIn/Twitter crawl `og:image` at share time, not page-load time, and
  do not execute JS — this is why the stats must be passed as query params
  to `/api/og` rather than relying on client-side state.
- Both Pages Functions return `Access-Control-Allow-Origin: *`.

## Explicitly out of scope for now

- User accounts, persistence, database
- A feed/gallery of other users' results
- Anything beyond the neutral `:root` CSS scaffold — the real visual
  identity lands in a later session
- Server-side rendering of the results page (the OG image covers social
  sharing without needing SSR)
