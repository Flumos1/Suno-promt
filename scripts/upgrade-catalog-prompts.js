/**
 * One-time, budget-capped editorial rewrite of every catalog style prompt.
 * Usage: node scripts/upgrade-catalog-prompts.js --sample
 *        node scripts/upgrade-catalog-prompts.js --all
 *        node scripts/upgrade-catalog-prompts.js --apply
 * The private checkpoint is ignored by Git. Never log or commit the API key.
 */
import { readFile, writeFile, rename } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const catalogPath = join(root, "data", "artists.json");
const progressPath = join(root, ".catalog-upgrade-progress.json");
const model = "gpt-6.1-sol";
const budget = 5;
const inputPrice = 2 / 1_000_000;
const outputPrice = 10 / 1_000_000;
const maxOutputTokens = 2600;
const batchSize = 6;
const concurrency = 4;
const sampleIds = new Set(["en-2pac", "en-abba", "in-a-r-rahman", "de-beethoven", "en-aphex-twin", "ar-fairuz"]);

const instructions = `You are a meticulous music producer editing a catalog of sound archetypes for the Suno Styles field.
For each named reference, write a UNIQUE, practical English style prompt of 45-80 words. The old prompt and metadata are fallible hints, not facts. Represent the artist's characteristic musical palette and the supplied era/subgenre without copying a specific song. Use concrete, audible details: rhythmic feel and groove, lead voice or instrumental lead, characteristic instrument roles, melodic/harmonic behavior, arrangement dynamics, recording/mix texture, and emotional character. Choose details that genuinely distinguish this reference from other artists of the same genre. For instrumental composers/producers, say instrumental and do not insert vocals or a language. For film composers, producers and other collaborative artists whose catalog spans multiple singers or languages, do not impose one fixed voice, gender or language. For vocal music, specify delivery and language only when reliable. Never use a person's or band's name, a song/album title, lyrics, exact BPM, exact key, invented technical specifications, or playlist/marketing language in the output prompt. Avoid generic adjectives and unsupported claims. Write concise comma-separated production directions, not an essay. Return JSON conforming to the schema.`;

const schema = {
  type: "object", additionalProperties: false, required: ["artists"],
  properties: {
    artists: {
      type: "array", items: {
        type: "object", additionalProperties: false, required: ["id", "prompt"],
        properties: { id: { type: "string" }, prompt: { type: "string" } }
      }
    }
  }
};

async function loadKey() {
  if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY;
  const env = await readFile(join(root, ".env"), "utf8");
  const match = env.match(/^OPENAI_API_KEY=(.+)$/m);
  if (!match) throw new Error("OPENAI_API_KEY is absent");
  return match[1].trim().replace(/^['"]|['"]$/g, "");
}

async function saveProgress(progress) {
  const temp = `${progressPath}.tmp`;
  await writeFile(temp, JSON.stringify(progress, null, 2) + "\n");
  await rename(temp, progressPath);
}

function validPrompt(artist, prompt) {
  if (typeof prompt !== "string") return "missing prompt";
  const words = prompt.trim().split(/\s+/).length;
  if (words < 38 || words > 95) return `length ${words} words`;
  if (/\b\d{2,3}\s*BPM\b/i.test(prompt)) return "unsupported exact BPM";
  if (/\b[A-G](?:#|b)?\s+(?:major|minor)\b/i.test(prompt)) return "unsupported exact key";
  if (/\b(playlist|inspired by|sounds like)\b/i.test(prompt)) return "marketing or artist-reference wording";
  const escapedName = artist.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (new RegExp(`(?<![\\p{L}\\p{N}])${escapedName}(?![\\p{L}\\p{N}])`, "iu").test(prompt))
    return "artist name in prompt";
  return null;
}

function responseText(response) {
  return response.output?.flatMap(item => item.content || [])
    .filter(item => item.type === "output_text").map(item => item.text).join("") || "";
}

async function rewriteBatch(artists, key) {
  const input = artists.map(a => ({ id: a.id, reference: a.name, era: a.era,
    genre: a.genre, subgenre: a.subgenre, region: a.languageLabel, old_prompt: a.prompt }));
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model, instructions, input: JSON.stringify(input),
      reasoning: { effort: "low" }, max_output_tokens: maxOutputTokens,
      text: { format: { type: "json_schema", name: "style_prompts", strict: true, schema } }
    })
  });
  const raw = await response.text();
  if (!response.ok) throw new Error(`OpenAI ${response.status}: ${raw.slice(0, 250)}`);
  const result = JSON.parse(raw);
  const usage = result.usage || {};
  const cost = (usage.input_tokens || 0) * inputPrice + (usage.output_tokens || 0) * outputPrice;
  return { result, cost };
}

async function main() {
  const mode = process.argv[2];
  if (!["--sample", "--all", "--apply"].includes(mode))
    throw new Error("Choose --sample, --all, or --apply");
  const catalog = JSON.parse(await readFile(catalogPath, "utf8"));
  let progress;
  try { progress = JSON.parse(await readFile(progressPath, "utf8")); }
  catch { progress = { model, spent: 0, done: {}, attempts: {} }; }
  if (progress.model !== model) throw new Error("Checkpoint model mismatch");

  if (mode === "--apply") {
    const missing = catalog.filter(a => !progress.done[a.id]);
    if (missing.length) throw new Error(`${missing.length} prompts still missing`);
    for (const artist of catalog) {
      artist.prompt = progress.done[artist.id];
      // These per-artist numbers were generated or guessed, not measured from audio.
      artist.bpm = null;
      artist.key = null;
      artist.vocals = null;
    }
    await writeFile(catalogPath, JSON.stringify(catalog, null, 2) + "\n");
    console.log(`Applied ${catalog.length} reviewed prompts; API spend <= $${progress.spent.toFixed(3)}`);
    return;
  }

  const key = await loadKey();
  const pool = mode === "--sample" ? catalog.filter(a => sampleIds.has(a.id)) : catalog;
  let remaining = pool.filter(a => !progress.done[a.id] && (progress.attempts[a.id] || 0) < 3);
  while (remaining.length) {
    // Reserve for maximum possible output and a conservative 8K input tokens.
    const worstNext = maxOutputTokens * outputPrice + 8000 * inputPrice;
    const groups = [];
    for (let i = 0; i < remaining.length && groups.length < concurrency; i += batchSize) {
      if (progress.spent + (groups.length + 1) * worstNext > budget) break;
      groups.push(remaining.slice(i, i + batchSize));
    }
    if (!groups.length) throw new Error(`Budget limit reached: $${progress.spent.toFixed(3)} of $${budget}`);
    for (const artists of groups) for (const a of artists)
      progress.attempts[a.id] = (progress.attempts[a.id] || 0) + 1;
    const outcomes = await Promise.all(groups.map(async artists => {
      try { return { artists, ...(await rewriteBatch(artists, key)) }; }
      catch (error) { return { artists, error }; }
    }));
    let fatal = null;
    for (const outcome of outcomes) {
      if (outcome.error) {
        console.log(`Batch failed: ${outcome.error.message}`);
        if (/OpenAI 4\d\d/.test(outcome.error.message)) fatal = outcome.error;
        else progress.spent += worstNext;
        continue;
      }
      progress.spent += outcome.cost;
      let parsed;
      try { parsed = JSON.parse(responseText(outcome.result)); }
      catch { parsed = { artists: [] }; }
      const expected = new Map(outcome.artists.map(a => [a.id, a]));
      for (const item of parsed.artists || []) {
        const artist = expected.get(item.id);
        if (!artist) continue;
        const problem = validPrompt(artist, item.prompt);
        if (!problem) progress.done[item.id] = item.prompt.trim();
        else console.log(`Review needed: ${item.id}: ${problem}`);
      }
      if (outcome.result.status !== "completed")
        console.log(`Incomplete response: ${outcome.result.status}`);
    }
    console.log(`${Object.keys(progress.done).length}/${catalog.length} · spent <= $${progress.spent.toFixed(3)}`);
    await saveProgress(progress);
    if (fatal) throw fatal;
    remaining = pool.filter(a => !progress.done[a.id] && (progress.attempts[a.id] || 0) < 3);
  }
  const missing = pool.filter(a => !progress.done[a.id]);
  console.log(`Mode ${mode}: ${pool.length - missing.length}/${pool.length} complete; spent <= $${progress.spent.toFixed(3)}`);
  if (missing.length) console.log(`Unresolved IDs: ${missing.map(a => a.id).join(", ")}`);
  if (mode === "--sample") for (const a of pool) console.log(`${a.name}: ${progress.done[a.id] || "MISSING"}`);
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
