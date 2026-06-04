# SiliconSense (clone)

A self-contained clone of a [SiliconSense-style](https://siliconsense.club/) **Suno AI prompt catalog**.
Search artists/styles and get ready-to-paste Suno v5.5 prompts, build vocal anchors,
analyze a reference track, and generate album-cover concepts — all behind an access-code gate.

Generation is **template-driven and deterministic** (same input → same output), so it
runs with **no external API keys**. `lib/promptGenerator.js#generateArtistCard` is the
single hook point if you later want to swap in a real LLM.

## Features

| Tab | What it does |
|-----|--------------|
| **Catalog** | Search the artist catalog. If a name isn't found, an AI-style card with a ready Suno prompt is generated on the fly. |
| **Vocal Anchor** | Build a unique vocal along 5 axes — pitch, timbre, delivery, texture, age — with an optional "donor" for spirit (no direct imitation). |
| **Reference** | Drop an mp3 to detect era / instruments / vocals and get a Suno prompt plus the 3 closest catalog artists. |
| **Cover Art** | Generate a 2048×2048 album-cover concept + palette for Spotify / Apple Music / Yandex. |

## Run

```bash
npm install
npm start            # http://localhost:3000
```

Demo access codes: `SILICON-DEMO`, `SUNO-2026`, `FREEPASS`
(override with the `ACCESS_CODES` env var, comma-separated).

```bash
npm test             # run the generator unit tests
```

## Layout

```
server.js                 Express API + static hosting
lib/promptGenerator.js    Prompt / anchor / analysis / cover generation
data/artists.json         Seed catalog
public/                   Front-end (index.html, styles.css, app.js)
test/                     Unit tests (node:test)
```

## Notes

- Reference analysis is a deterministic **mock** (derived from the filename); no real
  audio DSP is performed. Wire a real analyzer into `analyzeReference` to make it live.
- The access gate is a simple demo. In a real deployment, codes would be issued after
  payment and validated server-side against a store.
