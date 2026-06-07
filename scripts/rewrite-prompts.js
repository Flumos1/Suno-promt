/**
 * Batch AI prompt rewriter for artists.json
 * Uses GPT-4o-mini to rewrite all 812 artist prompts with accurate,
 * artist-specific descriptions (correct instruments, vocal style, era character).
 *
 * Run: node scripts/rewrite-prompts.js
 * Progress is saved to scripts/rewrite-progress.json after each batch.
 * Safe to interrupt and resume.
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
const BATCH_SIZE = 20;
const DELAY_MS = 1200; // stay under rate limits

const SYSTEM = `You are a music expert and Suno AI prompt specialist.
Rewrite artist prompts to be accurate and artist-specific.

Rules:
- 15–28 words per prompt, comma-separated style tags
- Start with "{era}s {subgenre} ({genre})" — keep the era/genre from input
- Include artist's ACTUAL signature instruments (not generic defaults)
- Accurate vocal description (the real style of THIS artist)
- Production style characteristic of this artist
- 1–2 mood words that fit this artist
- End with "{bpm} BPM" from input (keep the BPM number)
- NO keys, NO tonalities, NO "fits a X" playlist context
- English only, even for non-English artists (language tag already covers it)
- Be SPECIFIC — wrong instrument is worse than missing one

Return JSON array: [{"id": "...", "prompt": "..."}, ...]
Include ALL artists from the input batch.`;

async function callOpenAI(artists) {
  const userMsg = `Rewrite these ${artists.length} Suno prompts to accurately reflect each artist:\n\n` +
    artists.map(a =>
      `ID: ${a.id}\nArtist: ${a.name}\nGenre: ${a.genre} / ${a.subgenre}\nEra: ${a.era}\n` +
      `Language: ${a.language}\nBPM: ${a.bpm}\nCurrent prompt: ${a.prompt}\n`
    ).join("\n---\n") +
    "\n\nReturn JSON array [{id, prompt}] for all artists.";

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "authorization": `Bearer ${OPENAI_KEY}`
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      max_tokens: 4000,
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: userMsg }
      ]
    })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = await res.json();
  const raw = data.choices[0].message.content;
  const parsed = JSON.parse(raw);
  // Handle both {"results": [...]} and plain [...]
  return Array.isArray(parsed) ? parsed : (parsed.results || parsed.artists || Object.values(parsed)[0]);
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const artists = JSON.parse(fs.readFileSync(ARTISTS_PATH, "utf8"));

  // Load progress (ids already done)
  let done = new Set();
  if (fs.existsSync(PROGRESS_PATH)) {
    const prog = JSON.parse(fs.readFileSync(PROGRESS_PATH, "utf8"));
    done = new Set(prog.done || []);
    console.log(`Resuming — ${done.size} already done`);
  }

  // Build map for quick lookup
  const map = new Map(artists.map(a => [a.id, a]));

  const remaining = artists.filter(a => !done.has(a.id));
  console.log(`Artists to process: ${remaining.length} / ${artists.length}`);

  let batchNum = 0;
  for (let i = 0; i < remaining.length; i += BATCH_SIZE) {
    const batch = remaining.slice(i, i + BATCH_SIZE);
    batchNum++;
    process.stdout.write(`Batch ${batchNum} (${i + 1}–${Math.min(i + BATCH_SIZE, remaining.length)})… `);

    let results;
    try {
      results = await callOpenAI(batch);
    } catch (err) {
      console.error(`\nError on batch ${batchNum}: ${err.message}`);
      console.log("Waiting 10s before retry…");
      await sleep(10000);
      try {
        results = await callOpenAI(batch);
      } catch (err2) {
        console.error(`Retry failed: ${err2.message}. Skipping batch.`);
        continue;
      }
    }

    let updated = 0;
    for (const r of (results || [])) {
      const artist = map.get(r.id);
      if (artist && r.prompt && r.prompt.length > 20) {
        artist.prompt = r.prompt.trim();
        done.add(r.id);
        updated++;
      }
    }

    // Save progress after each batch
    fs.writeFileSync(ARTISTS_PATH, JSON.stringify([...map.values()], null, 2));
    fs.writeFileSync(PROGRESS_PATH, JSON.stringify({ done: [...done], total: artists.length }));

    console.log(`✓ ${updated} updated (${done.size}/${artists.length} total)`);

    if (i + BATCH_SIZE < remaining.length) await sleep(DELAY_MS);
  }

  console.log(`\nDone! ${done.size}/${artists.length} artists updated.`);
  if (done.size === artists.length) fs.unlinkSync(PROGRESS_PATH);
}

main().catch(err => { console.error("Fatal:", err); process.exit(1); });
