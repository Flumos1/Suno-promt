# SiliconSense (clone)

A self-contained clone of a [SiliconSense-style](https://siliconsense.club/) **Suno AI prompt catalog**.
Search artists/styles and get ready-to-paste Suno v5.5 prompts, build vocal anchors,
analyze a reference track, and generate album-cover concepts — all behind an access-code gate.

Works with **no API keys** (deterministic template generation). Add an LLM key to switch
on **real AI generation**. Reference analysis reads **real metadata** from the uploaded file.

## Features

| Tab | What it does |
|-----|--------------|
| **Catalog** | Search a catalog of 32 styles. If a name isn't found, a card with a ready Suno prompt is generated — by a real LLM if a key is set, otherwise by the template engine. |
| **Vocal Anchor** | Build a unique vocal along 5 axes — pitch, timbre, delivery, texture, age — with an optional "donor" for spirit (no direct imitation). |
| **Reference** | Upload an audio file. Real properties (duration, bitrate, sample rate, channels, codec, embedded tags) are read with `music-metadata`, turned into a Suno prompt, plus the 3 closest catalog artists. AI-enhanced when a key is set. |
| **Cover Art** | Generate a 2048×2048 album-cover concept + palette for Spotify / Apple Music / Yandex. |

A status pill in the header shows whether the **template** or a live **AI** engine is active.

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
data/artists.json         Catalog (32 styles)
public/                   Front-end (index.html, styles.css, app.js)
test/                     Unit tests (node:test)
```

## Notes

- Reference analysis extracts **real** container/codec metadata and embedded ID3/Vorbis
  tags. True musical BPM/key detection (DSP) is out of scope; when an LLM key is set the
  model infers genre/era/vocals from the real metadata for a richer prompt.
- The access gate is a simple demo. In a real deployment, codes would be issued after
  payment and validated server-side against a store.
