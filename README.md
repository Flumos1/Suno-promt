# SiliconSense (clone)

A self-contained clone of a [SiliconSense-style](https://siliconsense.club/) **Suno AI prompt catalog**.
Search artists/styles and get ready-to-paste Suno prompts, build vocal anchors,
analyze a reference track, and generate album-cover concepts — all behind an access-code gate.

Works with **no API keys** (deterministic template generation). Add an LLM key to switch
on **real AI generation**. Reference analysis reads **real metadata** from the uploaded file.

## Features

| Tab | What it does |
|-----|--------------|
| **Catalog** | 811 individually edited style entries with **faceted filters** (language/region, era, genre with live counts, mood) + search and pagination. Free vs **locked (freemium)** entries; unlock all with a code. Star any prompt to save it. If a search matches nothing, a card is generated on the fly. |
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

### Catalog maintenance

`data/artists.json` is the curated source of truth. Its original exact BPM and
key fields were generated or guessed rather than measured from representative
tracks, so the catalog leaves them unset. Prompts describe characteristic sound
without exact BPM, key, or artist names; they are style sketches rather than
transcriptions of any one recording. `scripts/upgrade-catalog-prompts.js` is the
budget-capped, resumable one-time editorial workflow. Its checkpoint is private
and ignored by Git. The legacy `scripts/buildCatalog.js` would overwrite the
edited catalog and requires an explicit overwrite flag.

## Run

```bash
npm install
npm start            # http://localhost:3000
```

Demo access codes: `SILICON-DEMO`, `SUNO-2026`, `FREEPASS`
(override with the `ACCESS_CODES` env var, comma-separated).

```bash
npm test             # includes real WAV parsing and in-memory audio sampling
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
scripts/buildCatalog.js   Legacy seed generator (overwrite guard)
data/artists.json         Curated catalog (811 styles, faceted)
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

### Owner-only deep audio analysis

Set `ADMIN_KEY`, `TOKEN_SECRET`, and `OPENAI_API_KEY` on the server. In
**Reference**, upload a track and choose **Deep sound analysis**, then enter
`ADMIN_KEY` in the AI Lab card. The browser exchanges it for a signed seven-day
owner token; the key itself is not stored. Paid audio analysis is restricted to
this owner token, while the ordinary metadata reference analysis stays available.

The server samples up to 60 seconds from the beginning, middle, and end of a
track and sends that sample to OpenAI's audio model. The report separates
audible evidence from uncertain estimates and produces an English Suno Style
prompt. A text-only editing pass tightens the prompt while keeping to the
listening evidence. BPM and key are listening estimates, never instrument measurements.
Processing runs as a background job because it may exceed a web request timeout.
Jobs and audio are held in memory only; job results expire after 15 minutes.
The model and API account must support `gpt-audio-1.5` (override with
`SONIC_AUDIO_MODEL` if needed). The editing pass uses `gpt-4o` by default
(override with `SONIC_PROMPT_MODEL`). Each analysis incurs OpenAI API usage charges.

### Owner-only composition form analysis

In **AI Lab**, choose an audio file in **Track DNA Decoder** and use the
separate **Composition Form** button. It samples up to twelve eight-second
excerpts across the track, displays what was heard at each point, estimates
section order, and drafts bracket-only instrumental tags for Suno's Lyrics field.
The tags are an arrangement suggestion. Section boundaries are approximate
because passages between excerpts are not heard. Tracks without distinguishable
changes show an uncertainty message instead of invented sections or tags.
This request is owner-only and incurs its own OpenAI API usage. Uploaded audio
and samples remain in memory; the result expires after 15 minutes.

### Save a Suno Workspace archive locally

Suno's Workspace contents cannot be listed with the TTAPI key. In Suno, select
the songs in a Workspace and use **Download All** to obtain a ZIP. In **AI Lab →
Suno Workspace → folder on your computer**, choose that ZIP, review its audio
file count, then pick a destination folder. The browser streams MP3/WAV/M4A and
other audio entries into a newly created subfolder, preserving nested folders.
It skips other file types, encrypted entries, and unsafe ZIP paths. The ZIP and
music stay on the user's computer; no audio is uploaded to this server or TTAPI.
Folder selection requires a current Chromium browser with the File System Access
API, such as Brave, Chrome, or Edge. The archive parser is zip.js.

> Note: Render's free tier sleeps after inactivity, so the first request after
> idle takes ~30s to wake.

## Notes

- The basic Reference analysis extracts container/codec metadata and embedded
  ID3/Vorbis tags. It does not listen to the sound. Use owner-only deep analysis
  when you need observations from the recording itself.
- The access gate is a simple demo. In a real deployment, codes would be issued after
  payment and validated server-side against a store.
