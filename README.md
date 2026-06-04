# SiliconSense (clone)

A self-contained clone of a [SiliconSense-style](https://siliconsense.club/) **Suno AI prompt catalog**.
Search artists/styles and get ready-to-paste Suno v5.5 prompts, build vocal anchors,
analyze a reference track, and generate album-cover concepts — all behind an access-code gate.

Works with **no API keys** (deterministic template generation). Add an LLM key to switch
on **real AI generation**. Reference analysis reads **real metadata** from the uploaded file.

## Features

| Tab | What it does |
|-----|--------------|
| **Catalog** | ~200 style entries with **faceted filters** (language/region, era 1960s–2020s, genre with live counts, mood) + search and pagination. Free vs **locked (freemium)** entries; unlock all with a code. Star any prompt to save it. If a search matches nothing, a card is generated on the fly. |
| **Vocal Anchor** | Build a unique vocal along 5 axes — pitch, timbre, delivery, texture, age — with an optional "donor" for spirit (no direct imitation). |
| **Reference** | Upload an audio file. Real properties (duration, bitrate, sample rate, channels, codec, embedded tags) are read with `music-metadata`, turned into a Suno prompt, plus the 3 closest catalog styles. AI-enhanced when a key is set. |
| **Cover Art** | Generate a 2048×2048 album-cover concept + palette for Spotify / Apple Music / Yandex. |
| **Structure** | Generate a Suno-ready arrangement with `[Section]` tags and production hints (standard / short / electronic / ballad presets). |
| **Lyrics** | Draft lyrics with verse/chorus tags from a theme + mood + language. Full lyrics with an AI key, structured skeleton otherwise. |
| **Saved** | Everything you star lives in the browser. Export to JSON or TXT. |

Header pills show the active **generation engine** (template / AI) and **catalog access** (free tier / full).

### Catalog access (freemium)

Most catalog prompts are locked behind a paywall in the demo. Reveal them with an
unlock code (demo: `SILICON-PRO`, `UNLOCK-ALL`; override with `UNLOCK_CODES`).
`free` entries are always visible.

### Rebuilding the catalog

```bash
node scripts/buildCatalog.js   # regenerates data/artists.json (deterministic)
```

## Run

```bash
npm install
npm start            # http://localhost:3000
```

Demo access codes: `SILICON-DEMO`, `SUNO-2026`, `FREEPASS`
(override with the `ACCESS_CODES` env var, comma-separated).

```bash
npm test             # 8 unit tests (incl. real WAV parsing)
```

## Enabling real AI generation

Set **one** of these before `npm start` (native `fetch`, no SDK needed):

```bash
# Anthropic
export ANTHROPIC_API_KEY=sk-ant-...
export ANTHROPIC_MODEL=claude-sonnet-4-6   # optional

# or OpenAI
export OPENAI_API_KEY=sk-...
export OPENAI_MODEL=gpt-4o-mini            # optional

# force a specific engine (optional): anthropic | openai | template
export AI_PROVIDER=anthropic
```

On Windows PowerShell use `$env:ANTHROPIC_API_KEY="sk-ant-..."`.

With a key set, catalog-miss cards and reference prompts are written by the model;
without one, everything still works via the deterministic templates.

## Layout

```
server.js                 Express API + static hosting + file upload
lib/promptGenerator.js    Template prompt / anchor / cover generation
lib/aiProvider.js         LLM hook (Anthropic / OpenAI) with template fallback
lib/audioAnalyzer.js      Real audio metadata extraction (music-metadata)
lib/songTools.js          Song-structure + lyrics (template + AI)
scripts/buildCatalog.js   Deterministic catalog generator
data/artists.json         Catalog (~200 styles, faceted)
public/                   Front-end (index.html, styles.css, app.js)
test/                     Unit tests (node:test)
```

## Deploy to Render

The repo ships a `render.yaml` blueprint. Either:

**One-click (Blueprint):** Render dashboard → *New* → *Blueprint* → pick the
`Flumos1/Suno-promt` repo → Apply. Render reads `render.yaml` and creates a free
web service (`npm install` + `npm start`).

**Manual:** *New* → *Web Service* → connect the repo → Build `npm install`,
Start `npm start`, plan Free. Render injects `PORT` automatically.

Set `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` (and optionally `ACCESS_CODES`,
`UNLOCK_CODES`) under *Environment* to enable real AI generation in production.

> Note: Render's free tier sleeps after inactivity, so the first request after
> idle takes ~30s to wake.

## Notes

- Reference analysis extracts **real** container/codec metadata and embedded ID3/Vorbis
  tags. True musical BPM/key detection (DSP) is out of scope; when an LLM key is set the
  model infers genre/era/vocals from the real metadata for a richer prompt.
- The access gate is a simple demo. In a real deployment, codes would be issued after
  payment and validated server-side against a store.
