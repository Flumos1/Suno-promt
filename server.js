import express from "express";
import multer from "multer";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  generateArtistCard,
  buildVocalAnchor,
  analyzeReference,
  buildCoverConcept
} from "./lib/promptGenerator.js";
import { aiEnabled, activeProvider, aiArtistCard, aiPromptFromAnalysis } from "./lib/aiProvider.js";
import { extractAudioMeta, promptFromMeta, closestFromMeta } from "./lib/audioAnalyzer.js";
import { buildSongStructure, aiSongStructure, buildLyricSkeleton, aiLyrics } from "./lib/songTools.js";
import { translateLyricsRuToEn, sceneToScore, imageToMoodPrompt, voiceMemoToPrompt, antiSlopRewrite } from "./lib/aiFeatures.js";
import { aiRateLimit } from "./lib/rateLimit.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;

const ACCESS_CODES = (process.env.ACCESS_CODES || "SILICON-DEMO,SUNO-2026,FREEPASS")
  .split(",").map((c) => c.trim().toUpperCase()).filter(Boolean);

// Premium unlock codes reveal the locked (paid) catalog entries.
const UNLOCK_CODES = (process.env.UNLOCK_CODES || "SILICON-PRO,UNLOCK-ALL")
  .split(",").map((c) => c.trim().toUpperCase()).filter(Boolean);

const catalog = JSON.parse(await readFile(join(__dirname, "data", "artists.json"), "utf8"));

// Stable label maps derived from data.
const LANGUAGE_LABELS = {};
for (const c of catalog) LANGUAGE_LABELS[c.language] = c.languageLabel;

const app = express();
app.use(express.json());
app.use(express.static(join(__dirname, "public")));

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

const isUnlocked = (token) => {
  try { return UNLOCK_CODES.includes(Buffer.from(String(token || ""), "base64").toString("utf8").toUpperCase()); }
  catch { return false; }
};

// Strip the prompt from locked entries unless the user is unlocked.
function publicEntry(c, unlocked) {
  const locked = !c.free && !unlocked;
  return {
    id: c.id, name: c.name, language: c.language, languageLabel: c.languageLabel,
    genre: c.genre, subgenre: c.subgenre, era: c.era, mood: c.mood,
    bpm: c.bpm, key: c.key, scenario: c.scenario, tags: c.tags,
    free: c.free, isNew: c.isNew, locked,
    prompt: locked ? null : c.prompt,
    vocals: locked ? null : c.vocals
  };
}

// --- Status ---
app.get("/api/status", (req, res) => {
  res.json({ ai: aiEnabled(), provider: activeProvider(), catalogSize: catalog.length });
});

// --- Facets (counts for the filter UI) ---
app.get("/api/facets", (req, res) => {
  const count = (key) => {
    const m = {};
    for (const c of catalog) { const v = c[key]; m[v] = (m[v] || 0) + 1; }
    return m;
  };
  res.json({
    total: catalog.length,
    free: catalog.filter((c) => c.free).length,
    isNew: catalog.filter((c) => c.isNew).length,
    genres: count("genre"),
    languages: Object.entries(count("language")).map(([code, n]) => ({ code, label: LANGUAGE_LABELS[code], n })),
    eras: count("era")
  });
});

// --- Access ---
app.post("/api/access", (req, res) => {
  const code = String(req.body?.code || "").trim().toUpperCase();
  if (ACCESS_CODES.includes(code)) return res.json({ ok: true, token: Buffer.from(code).toString("base64") });
  res.status(403).json({ ok: false, error: "Invalid access code" });
});

// --- Unlock premium catalog ---
app.post("/api/unlock", (req, res) => {
  const code = String(req.body?.code || "").trim().toUpperCase();
  if (UNLOCK_CODES.includes(code)) return res.json({ ok: true, token: Buffer.from(code).toString("base64") });
  res.status(403).json({ ok: false, error: "Invalid unlock code" });
});

// --- Catalog search with facet filters + pagination ---
app.get("/api/catalog", (req, res) => {
  const q = String(req.query.q || "").toLowerCase().trim();
  const { language, era, genre, mood, free, isNew } = req.query;
  const unlocked = isUnlocked(req.query.u);
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const pageSize = Math.min(60, parseInt(req.query.pageSize) || 24);

  let results = catalog.filter((c) => {
    if (language && c.language !== language) return false;
    if (era && c.era !== era) return false;
    if (genre && c.genre !== genre) return false;
    if (mood && !c.mood.includes(mood)) return false;
    if (free === "1" && !c.free) return false;
    if (isNew === "1" && !c.isNew) return false;
    if (q && !(
      c.name.toLowerCase().includes(q) ||
      c.genre.toLowerCase().includes(q) ||
      c.subgenre.toLowerCase().includes(q) ||
      c.tags.some((t) => t.toLowerCase().includes(q))
    )) return false;
    return true;
  });

  const total = results.length;
  const start = (page - 1) * pageSize;
  const pageItems = results.slice(start, start + pageSize).map((c) => publicEntry(c, unlocked));
  res.json({ results: pageItems, total, page, pageSize, pages: Math.ceil(total / pageSize), unlocked });
});

// --- Get or generate a card by name ---
app.get("/api/card/:name", async (req, res) => {
  const name = req.params.name;
  const found = catalog.find((a) => a.name.toLowerCase() === name.toLowerCase());
  if (found) return res.json({ card: publicEntry(found, isUnlocked(req.query.u)), source: "catalog" });
  if (aiEnabled()) {
    const aiCard = await aiArtistCard(name);
    if (aiCard) return res.json({ card: aiCard, source: "ai" });
  }
  res.json({ card: generateArtistCard(name), source: "generated" });
});

// --- Vocal anchor ---
app.post("/api/vocal-anchor", (req, res) => res.json(buildVocalAnchor(req.body || {})));

// --- Song structure ---
app.post("/api/song-structure", async (req, res) => {
  const base = buildSongStructure(req.body || {});
  if (aiEnabled()) {
    const ai = await aiSongStructure(req.body || {});
    if (ai) return res.json({ ...base, suno: ai, mode: "ai" });
  }
  res.json({ ...base, mode: "template" });
});

// --- Lyrics ---
app.post("/api/lyrics", async (req, res) => {
  const body = req.body || {};
  if (aiEnabled()) {
    const ai = await aiLyrics(body);
    if (ai) return res.json({ lyrics: ai, mode: "ai" });
  }
  res.json({ lyrics: buildLyricSkeleton(body), mode: "template" });
});

// --- Reference analysis ---
app.post("/api/analyze", upload.single("file"), async (req, res) => {
  try {
    let meta;
    if (req.file?.buffer) meta = await extractAudioMeta(req.file.buffer, req.file.originalname);
    else if (req.body?.filename) return res.json({ ...analyzeReference(req.body.filename, catalog), mode: "mock" });
    else return res.status(400).json({ error: "No audio file uploaded" });

    let prompt = promptFromMeta(meta);
    let closest = closestFromMeta(meta, catalog);
    let mode = "metadata";

    if (aiEnabled()) {
      const ai = await aiPromptFromAnalysis(meta, catalog.slice(0, 60).map((a) => a.name));
      if (ai) {
        prompt = ai.prompt || prompt;
        if (Array.isArray(ai.closest) && ai.closest.length) {
          const mapped = ai.closest.map((nm) => catalog.find((a) => a.name === nm)).filter(Boolean)
            .map((a) => ({ id: a.id, name: a.name, genre: a.genre }));
          if (mapped.length) closest = mapped;
        }
        meta.aiGenre = ai.genre; meta.aiVocals = ai.vocals; meta.aiEra = ai.era; mode = "ai";
      }
    }

    res.json({
      filename: meta.filename,
      detected: {
        era: meta.aiEra || meta.era, genre: meta.aiGenre || meta.tagGenre || "unknown",
        bpm: meta.tagBpm || null, durationSec: meta.durationSec, bitrate: meta.bitrate,
        sampleRate: meta.sampleRate, channels: meta.channels, codec: meta.codec, lossless: meta.lossless,
        vocals: meta.aiVocals || (meta.tagArtist ? `tagged: ${meta.tagArtist}` : "—")
      },
      prompt, closest, mode
    });
  } catch (err) {
    console.error("[analyze] failed:", err.message);
    res.status(500).json({ error: "Could not read this audio file" });
  }
});

// --- Cover concept ---
app.post("/api/cover", (req, res) => res.json(buildCoverConcept(req.body || {})));

// ─── Wave 1 AI Lab endpoints ──────────────────────────────────────────────
// All gated by aiRateLimit: 3 free/24h per IP, X-Unlock-Token bypasses.

app.post("/api/ai/translate-lyrics", aiRateLimit, async (req, res) => {
  const text = String(req.body?.text || "").trim();
  if (!text) return res.status(400).json({ ok: false, error: "Empty text" });
  if (text.length > 4000) return res.status(400).json({ ok: false, error: "Text too long (max 4000 chars)" });
  try {
    const result = await translateLyricsRuToEn(text);
    res.json(result);
  } catch (err) {
    console.error("[translate]", err.message);
    res.status(500).json({ ok: false, error: "Translation failed" });
  }
});

app.post("/api/ai/scene-to-score", aiRateLimit, async (req, res) => {
  const scene = String(req.body?.scene || "").trim();
  const lang = req.body?.lang === "ru" ? "ru" : "en";
  if (!scene) return res.status(400).json({ ok: false, error: "Empty scene" });
  if (scene.length > 2000) return res.status(400).json({ ok: false, error: "Scene too long (max 2000 chars)" });
  try {
    const result = await sceneToScore(scene, { lang });
    res.json(result);
  } catch (err) {
    console.error("[scene]", err.message);
    res.status(500).json({ ok: false, error: "Scoring failed" });
  }
});

app.post("/api/ai/anti-slop", aiRateLimit, async (req, res) => {
  const prompt = String(req.body?.prompt || "").trim();
  const flagged = Array.isArray(req.body?.flagged) ? req.body.flagged.slice(0, 30) : [];
  if (!prompt) return res.status(400).json({ ok: false, error: "Empty prompt" });
  if (prompt.length > 2000) return res.status(400).json({ ok: false, error: "Prompt too long" });
  try {
    const result = await antiSlopRewrite(prompt, flagged);
    res.json(result);
  } catch (err) {
    console.error("[anti-slop]", err.message);
    res.status(500).json({ ok: false, error: "Rewrite failed" });
  }
});

app.post("/api/ai/voice-memo", aiRateLimit, upload.single("audio"), async (req, res) => {
  if (!req.file?.buffer) return res.status(400).json({ ok: false, error: "No audio uploaded" });
  const mt = req.file.mimetype || "audio/webm";
  if (req.file.size > 25 * 1024 * 1024) {
    return res.status(400).json({ ok: false, error: "Audio too large (max 25MB)" });
  }
  try {
    const result = await voiceMemoToPrompt(req.file.buffer, mt, req.file.originalname);
    res.json(result);
  } catch (err) {
    console.error("[voice-memo]", err.message);
    res.status(500).json({ ok: false, error: "Voice processing failed" });
  }
});

app.post("/api/ai/mood-from-image", aiRateLimit, upload.single("image"), async (req, res) => {
  if (!req.file?.buffer) return res.status(400).json({ ok: false, error: "No image uploaded" });
  const mt = req.file.mimetype || "image/jpeg";
  if (!/^image\/(jpe?g|png|webp|gif)$/i.test(mt)) {
    return res.status(400).json({ ok: false, error: "Unsupported image type" });
  }
  if (req.file.size > 5 * 1024 * 1024) {
    return res.status(400).json({ ok: false, error: "Image too large (max 5MB)" });
  }
  try {
    const b64 = req.file.buffer.toString("base64");
    const result = await imageToMoodPrompt(b64, mt);
    res.json(result);
  } catch (err) {
    console.error("[mood-image]", err.message);
    res.status(500).json({ ok: false, error: "Image analysis failed" });
  }
});

app.listen(PORT, () => {
  console.log(`SiliconSense clone running at http://localhost:${PORT}`);
  console.log(`AI provider: ${activeProvider()} (${aiEnabled() ? "live" : "template fallback"}) · catalog ${catalog.length}`);
});

export default app;
