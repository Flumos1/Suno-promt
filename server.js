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
import { translateLyricsRuToEn, sceneToScore, imageToMoodPrompt, voiceMemoToPrompt, antiSlopRewrite, decodeDNA, transcribeAudio, styleTimeMachine, lyricsSyncConduct, styleGenome, buildPlaylist } from "./lib/aiFeatures.js";
import { aiRateLimit } from "./lib/rateLimit.js";
import { ttapiEnabled, submitMusic, fetchJob, submitSampleFromBuffer } from "./lib/ttapi.js";
import { auphonicEnabled, submitMasterJob, getMasterStatus, downloadMasterFile } from "./lib/auphonic.js";
import { lemonEnabled, createCheckout, findSubscriptionByEmail, createToken, verifyToken, verifyWebhookSig, planFromVariant } from "./lib/lemon.js";

// Temporary file store for reference audio (TTAPI upload needs a public URL).
// Files live max 5 min; cleaned up after TTAPI fetches them.
const tempFiles = new Map();
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of tempFiles) if (v.expires < now) tempFiles.delete(k);
}, 60_000).unref();

// Pending reference-generate jobs (upload runs in background to avoid Render timeout).
// Map: fakeJobId → { status: "ON_QUEUE"|"SUCCESS"|"FAILED", realJobId?, error? }
const pendingRefJobs = new Map();
setInterval(() => {
  const cutoff = Date.now() - 10 * 60 * 1000;
  for (const [k, v] of pendingRefJobs) if (v.created < cutoff) pendingRefJobs.delete(k);
}, 120_000).unref();

// Public URL base — used when uploading to TTAPI
const PUBLIC_BASE = process.env.PUBLIC_URL || "https://siliconsense.onrender.com";

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
  if (!token) return false;
  // Legacy unlock codes
  try {
    if (UNLOCK_CODES.includes(Buffer.from(String(token), "base64").toString("utf8").toUpperCase())) return true;
  } catch {}
  // LemonSqueezy subscription token
  return !!verifyToken(String(token));
};

const getTokenPlan = (token) => verifyToken(String(token || ""))?.plan || null;

const getRequestToken = (req) =>
  req.headers["x-unlock-token"] || req.body?.unlock || req.query?.u || "";

// Middleware factory: require one of the listed plans (or 403).
const requirePlan = (...plans) => (req, res, next) => {
  const plan = getTokenPlan(getRequestToken(req));
  if (!plans.includes(plan))
    return res.status(403).json({ ok: false, error: "plan_required", requiredPlans: plans });
  next();
};

// Monthly generation quota — tracked in-memory by customerId.
const genCounters = new Map(); // `${customerId}:YYYY-MM` -> count
setInterval(() => {
  const cur = new Date().toISOString().slice(0, 7);
  for (const [k] of genCounters) if (!k.endsWith(cur)) genCounters.delete(k);
}, 3_600_000).unref();

const GEN_QUOTA = { creator: 5, pro: 25 };

const checkGenQuota = (req, res, next) => {
  const verified = verifyToken(getRequestToken(req));
  if (!verified)
    return res.status(403).json({ ok: false, error: "plan_required", requiredPlans: ["creator", "pro"] });
  const { plan, customerId } = verified;
  const month = new Date().toISOString().slice(0, 7);
  const key = `${customerId}:${month}`;
  const quota = GEN_QUOTA[plan] ?? 0;
  const used = genCounters.get(key) || 0;
  if (used >= quota)
    return res.status(429).json({ ok: false, error: "gen_quota_exceeded", plan, used, limit: quota });
  req._genQuota = { key, used };
  next();
};

const incrementGenQuota = (req) => {
  if (!req._genQuota) return;
  genCounters.set(req._genQuota.key, req._genQuota.used + 1);
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

// --- Health check (for Render + uptime monitoring) ---
app.get("/health", (req, res) => res.json({ status: "ok", ts: Date.now(), catalog: catalog.length }));

// Admin: generate a test token (needs ADMIN_KEY env var)
app.get("/api/admin/token", (req, res) => {
  const key = process.env.ADMIN_KEY;
  if (!key || req.query.key !== key) return res.status(403).json({ error: "forbidden" });
  const plan = ["creator", "pro"].includes(req.query.plan) ? req.query.plan : "pro";
  const days = Math.min(Number(req.query.days) || 365, 730);
  const token = createToken(plan, "owner", days);
  res.json({ ok: true, token, plan, days });
});

// --- Status ---
app.get("/api/status", (req, res) => {
  res.json({ ai: aiEnabled(), provider: activeProvider(), catalogSize: catalog.length, generate: ttapiEnabled(), master: auphonicEnabled() });
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
  const { language, era, genre, mood, free, isNew, sort } = req.query;
  const unlocked = isUnlocked(req.query.u);
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const pageSize = Math.min(96, parseInt(req.query.pageSize) || 24);

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
      c.tags.some((t) => t.toLowerCase().includes(q)) ||
      (c.prompt && c.prompt.toLowerCase().includes(q))
    )) return false;
    return true;
  });

  // Sorting
  if (sort === "name_az") results.sort((a, b) => a.name.localeCompare(b.name));
  else if (sort === "name_za") results.sort((a, b) => b.name.localeCompare(a.name));
  else if (sort === "bpm_asc") results.sort((a, b) => (a.bpm || 0) - (b.bpm || 0));
  else if (sort === "bpm_desc") results.sort((a, b) => (b.bpm || 0) - (a.bpm || 0));
  else if (sort === "era_new") results.sort((a, b) => (b.era || "").localeCompare(a.era || ""));
  else if (sort === "era_old") results.sort((a, b) => (a.era || "").localeCompare(b.era || ""));

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

// ── Temp file serving (for TTAPI upload reference) ──────────────────────
app.get("/api/tmp/:id", (req, res) => {
  const f = tempFiles.get(req.params.id);
  if (!f || Date.now() > f.expires) return res.status(404).send("expired");
  res.setHeader("Content-Type", f.mime || "audio/mpeg");
  res.setHeader("Content-Length", f.buffer.length);
  res.end(f.buffer);
});

// ── Reference → Generate (TTAPI sample-to-song) ──────────────────────────
app.post("/api/ai/reference-generate", checkGenQuota, upload.single("audio"), async (req, res) => {
  if (!ttapiEnabled()) return res.status(503).json({ ok: false, error: "Track generation not configured (TTAPI_KEY missing)" });
  if (!req.file?.buffer) return res.status(400).json({ ok: false, error: "No audio file uploaded" });
  if (req.file.size > 25 * 1024 * 1024) return res.status(400).json({ ok: false, error: "File too large (max 25MB)" });
  // Return immediately — upload+sample run in background to avoid Render's ~30s timeout.
  const { randomUUID } = await import("node:crypto");
  const fakeId = "ref-" + randomUUID();
  const opts = {
    startSec: Math.max(0, Number(req.body?.startSec ?? 0)),
    endSec: Math.min(120, Math.max(Number(req.body?.startSec ?? 0) + 1, Number(req.body?.endSec ?? 30))),
    tags: req.body?.tags || undefined,
    lyrics: req.body?.lyrics || undefined,
    descriptionPrompt: req.body?.description || undefined,
    instrumental: req.body?.instrumental === "true" || req.body?.instrumental === true,
    mv: req.body?.mv || undefined,
    vocalGender: req.body?.vocalGender || undefined,
    audioWeight: req.body?.audioWeight !== undefined ? Number(req.body.audioWeight) : 0.7
  };
  pendingRefJobs.set(fakeId, { status: "ON_QUEUE", created: Date.now() });
  incrementGenQuota(req);
  res.json({ ok: true, jobId: fakeId });

  // Background: upload file to TTAPI then submit sample job
  (async () => {
    try {
      const { jobId } = await submitSampleFromBuffer(
        req.file.buffer, req.file.mimetype || "audio/mpeg", tempFiles, PUBLIC_BASE, opts
      );
      pendingRefJobs.set(fakeId, { status: "DELEGATED", realJobId: jobId, created: Date.now() });
    } catch (err) {
      console.error("[reference-generate-bg]", err.message);
      pendingRefJobs.set(fakeId, { status: "FAILED", error: err.message, created: Date.now() });
    }
  })();
});

// ─── Real Suno track generation (TTAPI) ──────────────────────────────────
// Submit returns a jobId; the client polls /api/ai/track-status. We keep the
// HTTP requests short (no long-held connection) since Render may time out.

app.post("/api/ai/time-machine", aiRateLimit, async (req, res) => {
  const artist = String(req.body?.artist || "").trim();
  const era = String(req.body?.era || "").trim();
  if (!artist || !era) return res.status(400).json({ ok: false, error: "artist and era required" });
  try {
    const result = await styleTimeMachine(artist, era, { note: req.body?.note });
    res.json(result);
  } catch (err) {
    console.error("[time-machine]", err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post("/api/ai/lyrics-sync", aiRateLimit, async (req, res) => {
  const lyrics = String(req.body?.lyrics || "").trim();
  const style = String(req.body?.style || "").trim();
  if (!lyrics) return res.status(400).json({ ok: false, error: "lyrics required" });
  if (lyrics.length > 5000) return res.status(400).json({ ok: false, error: "lyrics too long (max 5000)" });
  try {
    const result = await lyricsSyncConduct(lyrics, style);
    res.json(result);
  } catch (err) {
    console.error("[lyrics-sync]", err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Track DNA Decoder — full analysis: metadata + Whisper + Claude report + catalog match
app.post("/api/ai/dna-decode", requirePlan("creator", "pro"), upload.single("file"), async (req, res) => {
  if (!req.file?.buffer) return res.status(400).json({ ok: false, error: "No audio file uploaded" });
  if (req.file.size > 25 * 1024 * 1024) return res.status(400).json({ ok: false, error: "File too large (max 25MB)" });
  try {
    const buf = req.file.buffer;
    const mime = req.file.mimetype || "audio/mpeg";
    const name = req.file.originalname || "track";

    // Step 1: extract metadata (existing, fast)
    const { extractAudioMeta } = await import("./lib/audioAnalyzer.js");
    const meta = await extractAudioMeta(buf, name);

    // Step 2: Whisper transcription (parallel-friendly, may be empty for instrumentals)
    const { transcript } = await transcribeAudio(buf, mime);

    // Step 3: Claude producer report + catalog match
    const catalogNames = catalog.slice(0, 300).map((a) => a.name); // top 300 by catalog order
    const dna = await decodeDNA(meta, transcript, catalogNames);
    if (!dna.ok) return res.status(500).json(dna);

    // Enrich closest[] with full catalog entries
    const closest = (dna.closest || []).map((c) => {
      const found = catalog.find((a) => a.name.toLowerCase() === c.name.toLowerCase());
      return found ? { ...c, id: found.id, genre: found.genre, prompt: found.prompt, bpm: found.bpm, key: found.key } : c;
    });

    res.json({
      ok: true,
      meta: {
        filename: meta.filename, duration: meta.durationSec, bitrate: meta.bitrate,
        sampleRate: meta.sampleRate, codec: meta.codec, tagBpm: meta.tagBpm,
        tagGenre: meta.tagGenre, tagArtist: meta.tagArtist, tagTitle: meta.tagTitle
      },
      transcript: transcript || null,
      analysis: {
        era: dna.era, genre: dna.genre, subgenre: dna.subgenre,
        mood: dna.mood, bpm: dna.bpm_estimate, key: dna.key_estimate,
        instruments: dna.instruments, vocals: dna.vocals, production: dna.production,
        producerNote: dna.producer_note
      },
      sunoPrompt: dna.suno_prompt,
      closest
    });
  } catch (err) {
    console.error("[dna-decode]", err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post("/api/ai/generate-track", checkGenQuota, async (req, res) => {
  if (!ttapiEnabled()) return res.status(503).json({ ok: false, error: "Track generation not configured (TTAPI_KEY missing)" });
  const tags = String(req.body?.tags || req.body?.prompt || "").trim();
  if (!tags) return res.status(400).json({ ok: false, error: "Empty prompt/tags" });
  try {
    const lyrics = req.body?.lyrics ? String(req.body.lyrics).trim() : "";
    const instrumental = !!req.body?.instrumental;
    // TTAPI requires `prompt` (lyrics) when custom=true && !instrumental.
    // Without lyrics → use inspiration mode (custom=false, gpt_description_prompt).
    const useCustom = instrumental || lyrics.length > 0;
    const { jobId } = await submitMusic({
      tags,
      title: req.body?.title ? String(req.body.title).slice(0, 80) : undefined,
      prompt: lyrics || undefined,
      descriptionPrompt: !useCustom ? tags : undefined,
      instrumental,
      custom: useCustom,
      mv: req.body?.mv || undefined,
      vocalGender: req.body?.vocalGender || undefined
    });
    if (!jobId) throw new Error("No jobId returned");
    incrementGenQuota(req);
    res.json({ ok: true, jobId });
  } catch (err) {
    console.error("[generate-track]", err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get("/api/ai/track-status", async (req, res) => {
  if (!ttapiEnabled()) return res.status(503).json({ ok: false, error: "Not configured" });
  const jobId = String(req.query.jobId || "").trim();
  if (!jobId) return res.status(400).json({ ok: false, error: "Missing jobId" });

  // Handle background reference-generate jobs
  if (jobId.startsWith("ref-")) {
    const pending = pendingRefJobs.get(jobId);
    if (!pending) return res.status(404).json({ ok: false, error: "Job not found" });
    if (pending.status === "FAILED") return res.json({ ok: true, status: "FAILED", error: pending.error });
    if (pending.status === "ON_QUEUE") return res.json({ ok: true, status: "ON_QUEUE", progress: "Uploading reference…" });
    // DELEGATED — poll the real TTAPI job
    try {
      const job = await fetchJob(pending.realJobId);
      res.json({ ok: true, ...job });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
    return;
  }

  try {
    const job = await fetchJob(jobId);
    res.json({ ok: true, ...job });
  } catch (err) {
    console.error("[track-status]", err.message);
    res.status(500).json({ ok: false, error: err.message });
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

app.post("/api/ai/style-genome", aiRateLimit, async (req, res) => {
  const artists = req.body?.artists;
  if (!Array.isArray(artists) || artists.length < 2) {
    return res.status(400).json({ ok: false, error: "Need at least 2 artists" });
  }
  if (artists.length > 3) {
    return res.status(400).json({ ok: false, error: "Max 3 artists" });
  }
  for (const a of artists) {
    if (!a.name || typeof a.weight !== "number" || a.weight <= 0) {
      return res.status(400).json({ ok: false, error: "Each artist needs name and weight > 0" });
    }
  }
  try {
    const result = await styleGenome(artists);
    res.json(result);
  } catch (err) {
    console.error("[style-genome]", err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post("/api/ai/playlist-build", aiRateLimit, async (req, res) => {
  const style = String(req.body?.style || "").trim();
  const theme = String(req.body?.theme || "").trim();
  const count = Math.min(Math.max(Number(req.body?.count) || 8, 3), 12);
  if (!style) return res.status(400).json({ ok: false, error: "Style required" });
  if (style.length > 500) return res.status(400).json({ ok: false, error: "Style too long (max 500)" });
  try {
    const result = await buildPlaylist(style, theme, count);
    res.json(result);
  } catch (err) {
    console.error("[playlist]", err.message);
    res.status(500).json({ ok: false, error: "Playlist generation failed" });
  }
});

// ─── Auphonic Mastering ──────────────────────────────────────────────────
// In-memory job store: jobId → { createdAt }
const masterJobs = new Map();
setInterval(() => {
  const cutoff = Date.now() - 24 * 3600 * 1000;
  for (const [id, j] of masterJobs) if (j.createdAt < cutoff) masterJobs.delete(id);
}, 3600 * 1000).unref();

app.post("/api/ai/master-track", requirePlan("pro"), async (req, res) => {
  if (!auphonicEnabled()) return res.status(503).json({ ok: false, error: "Mastering not configured (AUPHONIC_USER/PASS missing)" });
  const audioUrl = String(req.body?.audioUrl || "").trim();
  const loudness = String(req.body?.loudness || "streaming");
  if (!audioUrl) return res.status(400).json({ ok: false, error: "audioUrl required" });
  try { const u = new URL(audioUrl); if (!["http:", "https:"].includes(u.protocol)) throw new Error(); }
  catch { return res.status(400).json({ ok: false, error: "audioUrl must be a valid http(s) URL" }); }
  try {
    const { jobId } = await submitMasterJob(audioUrl, { loudness });
    masterJobs.set(jobId, { createdAt: Date.now() });
    res.json({ ok: true, jobId });
  } catch (err) {
    console.error("[auphonic-submit]", err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get("/api/ai/master-status", async (req, res) => {
  if (!auphonicEnabled()) return res.status(503).json({ ok: false, error: "Not configured" });
  const jobId = String(req.query.jobId || "").trim();
  if (!jobId) return res.status(400).json({ ok: false, error: "Missing jobId" });
  // No in-memory Map check — Auphonic UUID is the authorisation. This makes the endpoint
  // resilient to server restarts (which clear masterJobs) while a poll is in flight.
  try {
    const result = await getMasterStatus(jobId);
    // Replace the direct Auphonic URL with our proxy so the browser never needs auth.
    if (result.downloadUrl) {
      result.downloadUrl = `/api/ai/master-download?jobId=${encodeURIComponent(jobId)}`;
    }
    res.json({ ok: true, ...result });
  } catch (err) {
    console.error("[auphonic-status]", err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get("/api/ai/master-download", async (req, res) => {
  if (!auphonicEnabled()) return res.status(503).end();
  const jobId = String(req.query.jobId || "").trim();
  if (!jobId) return res.status(400).end();
  try {
    const status = await getMasterStatus(jobId);
    if (status.status !== "Success" || !status.downloadUrl) {
      return res.status(404).json({ ok: false, error: "Not ready" });
    }
    const buf = await downloadMasterFile(status.downloadUrl);
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Content-Disposition", 'inline; filename="mastered.mp3"');
    res.end(buf);
  } catch (err) {
    console.error("[auphonic-download]", err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── LemonSqueezy Subscription Routes ────────────────────────────────────

// POST /api/lemon/checkout — create hosted checkout URL
app.post("/api/lemon/checkout", async (req, res) => {
  if (!lemonEnabled()) return res.status(503).json({ ok: false, error: "Payments not configured" });
  const plan = String(req.body?.plan || "").toLowerCase();
  const variantId = plan === "pro"
    ? process.env.LEMON_VARIANT_PRO
    : process.env.LEMON_VARIANT_CREATOR;
  if (!variantId) return res.status(400).json({ ok: false, error: "Invalid plan" });
  try {
    const successUrl = `${PUBLIC_BASE}/?activated=1`;
    const cancelUrl = `${PUBLIC_BASE}/`;
    const { checkoutUrl } = await createCheckout(variantId, { successUrl, cancelUrl });
    res.json({ ok: true, checkoutUrl });
  } catch (err) {
    console.error("[lemon-checkout]", err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /api/lemon/activate — user enters email after payment → get access token
app.post("/api/lemon/activate", async (req, res) => {
  if (!lemonEnabled()) return res.status(503).json({ ok: false, error: "Payments not configured" });
  const email = String(req.body?.email || "").trim();
  if (!email || !email.includes("@")) return res.status(400).json({ ok: false, error: "Invalid email" });
  try {
    const sub = await findSubscriptionByEmail(email);
    if (!sub) return res.status(404).json({ ok: false, error: "No active subscription found for this email" });
    const token = createToken(sub.plan || "creator", String(sub.subscriptionId));
    res.json({ ok: true, token, plan: sub.plan });
  } catch (err) {
    console.error("[lemon-activate]", err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/lemon/status — check current token plan + monthly gen quota
app.get("/api/lemon/status", (req, res) => {
  const token = req.headers["x-unlock-token"] || req.query.token || "";
  const info = verifyToken(String(token));
  if (!info) return res.json({ ok: false, plan: null });
  const month = new Date().toISOString().slice(0, 7);
  const genUsed = genCounters.get(`${info.customerId}:${month}`) || 0;
  const genLimit = GEN_QUOTA[info.plan] ?? 0;
  res.json({ ok: true, plan: info.plan, genUsed, genLimit });
});

// POST /api/lemon/webhook — LemonSqueezy event handler
app.post("/api/lemon/webhook", express.raw({ type: "application/json" }), (req, res) => {
  const sig = req.headers["x-signature"] || "";
  const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body));
  if (!verifyWebhookSig(rawBody, sig)) {
    console.warn("[lemon-webhook] Invalid signature");
    return res.status(401).send("Invalid signature");
  }
  const event = JSON.parse(rawBody.toString());
  const eventName = event.meta?.event_name || "";
  const attrs = event.data?.attributes || {};
  console.log(`[lemon-webhook] ${eventName} — ${attrs.user_email} plan=${planFromVariant(attrs.variant_id)}`);
  res.sendStatus(200);
});

app.listen(PORT, () => {
  console.log(`SiliconSense clone running at http://localhost:${PORT}`);
  console.log(`AI provider: ${activeProvider()} (${aiEnabled() ? "live" : "template fallback"}) · catalog ${catalog.length}`);
});

export default app;
