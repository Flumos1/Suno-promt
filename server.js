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

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;

// Demo access codes. In production these would be issued after payment.
const ACCESS_CODES = (process.env.ACCESS_CODES || "SILICON-DEMO,SUNO-2026,FREEPASS")
  .split(",")
  .map((c) => c.trim().toUpperCase())
  .filter(Boolean);

const catalog = JSON.parse(
  await readFile(join(__dirname, "data", "artists.json"), "utf8")
);

const app = express();
app.use(express.json());
app.use(express.static(join(__dirname, "public")));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 } // 25 MB
});

// --- Status (lets the UI show whether real AI is active) ---
app.get("/api/status", (req, res) => {
  res.json({
    ai: aiEnabled(),
    provider: activeProvider(),
    catalogSize: catalog.length
  });
});

// --- Access ---
app.post("/api/access", (req, res) => {
  const code = String(req.body?.code || "").trim().toUpperCase();
  if (ACCESS_CODES.includes(code)) {
    return res.json({ ok: true, token: Buffer.from(code).toString("base64") });
  }
  res.status(403).json({ ok: false, error: "Invalid access code" });
});

// --- Catalog search ---
app.get("/api/catalog", (req, res) => {
  const q = String(req.query.q || "").toLowerCase().trim();
  if (!q) return res.json({ results: catalog });
  const results = catalog.filter(
    (a) =>
      a.name.toLowerCase().includes(q) ||
      a.genre.toLowerCase().includes(q) ||
      a.tags.some((t) => t.includes(q))
  );
  res.json({ results });
});

// --- Get or generate a card by name (AI when available, template otherwise) ---
app.get("/api/card/:name", async (req, res) => {
  const name = req.params.name;
  const found = catalog.find((a) => a.name.toLowerCase() === name.toLowerCase());
  if (found) return res.json({ card: found, source: "catalog" });

  if (aiEnabled()) {
    const aiCard = await aiArtistCard(name);
    if (aiCard) return res.json({ card: aiCard, source: "ai" });
  }
  res.json({ card: generateArtistCard(name), source: "generated" });
});

// --- Vocal anchor ---
app.post("/api/vocal-anchor", (req, res) => {
  res.json(buildVocalAnchor(req.body || {}));
});

// --- Reference analysis: real metadata extraction (+ AI prompt when available) ---
app.post("/api/analyze", upload.single("file"), async (req, res) => {
  try {
    let meta;
    if (req.file?.buffer) {
      meta = await extractAudioMeta(req.file.buffer, req.file.originalname);
    } else if (req.body?.filename) {
      // Backwards-compatible path: no real file, fall back to the mock.
      return res.json({ ...analyzeReference(req.body.filename, catalog), mode: "mock" });
    } else {
      return res.status(400).json({ error: "No audio file uploaded" });
    }

    let prompt = promptFromMeta(meta);
    let closest = closestFromMeta(meta, catalog);
    let mode = "metadata";

    if (aiEnabled()) {
      const ai = await aiPromptFromAnalysis(meta, catalog.map((a) => a.name));
      if (ai) {
        prompt = ai.prompt || prompt;
        if (Array.isArray(ai.closest) && ai.closest.length) {
          closest = ai.closest
            .map((nm) => catalog.find((a) => a.name === nm))
            .filter(Boolean)
            .map((a) => ({ id: a.id, name: a.name, genre: a.genre }));
          if (!closest.length) closest = closestFromMeta(meta, catalog);
        }
        meta.aiGenre = ai.genre;
        meta.aiVocals = ai.vocals;
        meta.aiEra = ai.era;
        mode = "ai";
      }
    }

    res.json({
      filename: meta.filename,
      detected: {
        era: meta.aiEra || meta.era,
        genre: meta.aiGenre || meta.tagGenre || "unknown",
        bpm: meta.tagBpm || null,
        durationSec: meta.durationSec,
        bitrate: meta.bitrate,
        sampleRate: meta.sampleRate,
        channels: meta.channels,
        codec: meta.codec,
        lossless: meta.lossless,
        vocals: meta.aiVocals || (meta.tagArtist ? `tagged: ${meta.tagArtist}` : "—")
      },
      prompt,
      closest,
      mode
    });
  } catch (err) {
    console.error("[analyze] failed:", err.message);
    res.status(500).json({ error: "Could not read this audio file" });
  }
});

// --- Cover concept ---
app.post("/api/cover", (req, res) => {
  res.json(buildCoverConcept(req.body || {}));
});

app.listen(PORT, () => {
  console.log(`SiliconSense clone running at http://localhost:${PORT}`);
  console.log(`AI provider: ${activeProvider()} (${aiEnabled() ? "live" : "template fallback"})`);
});

export default app;
