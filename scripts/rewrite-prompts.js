/**
 * Batch AI prompt rewriter for artists.json — GPT-4o, fixed format.
 * Main languages (en/ru/uk/fr/it/de/es/pt) → batch 5, strict prompt.
 * Regional/exotic languages → batch 20.
 *
 * Run: node scripts/rewrite-prompts.js
 * Progress saved after each batch — safe to interrupt and resume.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env
const envPath = path.join(__dirname, "../.env");
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, "utf8").split("\n").forEach((line) => {
    const m = line.match(/^([A-Z_]+)=(.+)$/);
    if (m) process.env[m[1]] = m[2].trim();
  });
}

const OPENAI_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_KEY) { console.error("OPENAI_API_KEY not found"); process.exit(1); }

const ARTISTS_PATH = path.join(__dirname, "../data/artists.json");
const PROGRESS_PATH = path.join(__dirname, "rewrite-progress.json");
const DELAY_MS = 800;

const MAIN_LANGS = new Set(["en", "ru", "uk", "fr", "it", "de", "es", "pt"]);
const BATCH_MAIN = 5;
const BATCH_OTHER = 20;

// ─── System prompts ────────────────────────────────────────────────────────

const EXAMPLE_BLOCK = `
EXAMPLE OUTPUT (this is exactly the format required):
{"artists": [
  {"id": "en-2pac", "prompt": "1990s west-coast hip-hop (hip-hop), passionate raw male rap, English-language vocals, booming 808s, piano soul samples, rolling hi-hats, dusty lo-fi mix, defiant and melancholic mood, 101 BPM"},
  {"id": "en-nirvana", "prompt": "1990s grunge (rock), raspy angst-driven male lead, English-language vocals, distorted guitar power chords, melodic bass, crashing live drums, raw tape-saturated production, cathartic and abrasive mood, 131 BPM"}
]}`;

const SYSTEM_DEEP = `You are an expert music producer with encyclopedic knowledge of all artists worldwide.
Your task: write accurate Suno AI STYLE TAGS for each artist — comma-separated descriptors, NOT a sentence or description.

FORMAT RULES (strictly follow every rule):
1. Exactly: "{era}s {subgenre} ({genre}), {vocal style}, {language}-language vocals, {instrument 1}, {instrument 2}, {instrument 3}, {production style}, {mood 1} and {mood 2} mood, {bpm} BPM"
2. Vocal style = specific (e.g. "raspy gravelly baritone", NOT just "male vocals")
3. Instruments = ONLY this artist's REAL signature instruments (no generic defaults)
4. Production = their actual aesthetic (e.g. "lo-fi cassette warmth", "polished stadium mix")
5. NO narrative. NO "inspired by". NO "fits a playlist". NO key/tonality. Pure Suno tags only.
6. Return JSON object: {"artists": [{"id": "...", "prompt": "..."}, ...]}
${EXAMPLE_BLOCK}`;

const SYSTEM_BROAD = `You are a music expert. Write Suno AI style tags (comma-separated) for each artist.

FORMAT: "{era}s {subgenre} ({genre}), {vocal style}, {language}-language vocals, {instruments}, {production}, {mood} mood, {bpm} BPM"
- No narrative sentences. Pure comma-separated style tags only.
- Keep the exact BPM from input.
- Return JSON: {"artists": [{"id": "...", "prompt": "..."}, ...]}
${EXAMPLE_BLOCK}`;

// ─── API call ──────────────────────────────────────────────────────────────

async function callOpenAI(artists) {
  const isDeep = MAIN_LANGS.has(artists[0]?.language);
  const system = isDeep ? SYSTEM_DEEP : SYSTEM_BROAD;

  const userMsg = `Write Suno style prompts for these ${artists.length} artists:\n\n` +
    artists.map(a =>
      `ID: ${a.id}\nArtist: ${a.name} | ${a.genre} / ${a.subgenre} | ${a.era} | lang:${a.language} | ${a.bpm} BPM`
    ).join("\n") +
    `\n\nReturn {"artists": [{"id": "...", "prompt": "..."}]} for ALL ${artists.length} artists.`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "authorization": `Bearer ${OPENAI_KEY}`
    },
    body: JSON.stringify({
      model: "gpt-4o",
      max_tokens: isDeep ? 1400 : 3500,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: userMsg }
      ]
    })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI ${res.status}: ${text.slice(0, 300)}`);
  }

  const data = await res.json();
  const raw = data.choices[0].message.content;

  let parsed;
  try { parsed = JSON.parse(raw); } catch { throw new Error("JSON parse failed: " + raw.slice(0, 200)); }

  // Handle various wrapper formats GPT-4o might return
  if (Array.isArray(parsed)) return parsed;
  if (parsed.artists) return parsed.artists;
  if (parsed.results) return parsed.results;
  if (parsed.prompts) return parsed.prompts;
  // Single object with id+prompt
  if (parsed.id && parsed.prompt) return [parsed];
  // Try first array value
  const firstArr = Object.values(parsed).find(Array.isArray);
  if (firstArr) return firstArr;

  throw new Error("Unexpected response shape: " + JSON.stringify(parsed).slice(0, 200));
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const artists = JSON.parse(fs.readFileSync(ARTISTS_PATH, "utf8"));

  let done = new Set();
  if (fs.existsSync(PROGRESS_PATH)) {
    const prog = JSON.parse(fs.readFileSync(PROGRESS_PATH, "utf8"));
    done = new Set(prog.done || []);
    console.log(`Resuming — ${done.size} already done`);
  }

  const map = new Map(artists.map(a => [a.id, a]));
  const remaining = artists.filter(a => !done.has(a.id));

  const mainArtists  = remaining.filter(a => MAIN_LANGS.has(a.language));
  const otherArtists = remaining.filter(a => !MAIN_LANGS.has(a.language));

  console.log(`Main languages (batch ${BATCH_MAIN}): ${mainArtists.length}`);
  console.log(`Regional      (batch ${BATCH_OTHER}): ${otherArtists.length}`);
  console.log(`Total remaining: ${remaining.length} / ${artists.length}\n`);

  async function processBatches(list, batchSize, label) {
    for (let i = 0; i < list.length; i += batchSize) {
      const batch = list.slice(i, i + batchSize);
      const end = Math.min(i + batchSize, list.length);
      process.stdout.write(`[${label}] ${i + 1}–${end}… `);

      let results = null;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          results = await callOpenAI(batch);
          break;
        } catch (err) {
          process.stdout.write(`\n  Err(${attempt}): ${err.message.slice(0,120)}\n  `);
          if (attempt < 3) await sleep(6000);
        }
      }
      if (!results) { console.log("skipped"); continue; }

      let updated = 0;
      for (const r of results) {
        if (!r?.id || !r?.prompt) continue;
        const artist = map.get(r.id);
        if (artist && r.prompt.length > 20 && !r.prompt.toLowerCase().startsWith("create")) {
          artist.prompt = r.prompt.trim();
          done.add(r.id);
          updated++;
        }
      }

      fs.writeFileSync(ARTISTS_PATH, JSON.stringify([...map.values()], null, 2));
      fs.writeFileSync(PROGRESS_PATH, JSON.stringify({ done: [...done], total: artists.length }));
      console.log(`✓ ${updated}/${batch.length} (${done.size}/${artists.length} total)`);

      if (i + batchSize < list.length) await sleep(DELAY_MS);
    }
  }

  await processBatches(mainArtists, BATCH_MAIN, "MAIN");
  await processBatches(otherArtists, BATCH_OTHER, "REGIONAL");

  console.log(`\nDone! ${done.size}/${artists.length} updated.`);
  if (done.size >= artists.length - 2) {
    try { fs.unlinkSync(PROGRESS_PATH); } catch {}
  }
}

main().catch(err => { console.error("Fatal:", err); process.exit(1); });
