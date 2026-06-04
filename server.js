import express from "express";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  generateArtistCard,
  buildVocalAnchor,
  analyzeReference,
  buildCoverConcept
} from "./lib/promptGenerator.js";

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

// --- Get or generate a card by name ---
app.get("/api/card/:name", (req, res) => {
  const name = req.params.name;
  const found = catalog.find((a) => a.name.toLowerCase() === name.toLowerCase());
  if (found) return res.json({ card: found, source: "catalog" });
  res.json({ card: generateArtistCard(name), source: "generated" });
});

// --- Vocal anchor ---
app.post("/api/vocal-anchor", (req, res) => {
  res.json(buildVocalAnchor(req.body || {}));
});

// --- Reference analysis (mock; accepts a filename) ---
app.post("/api/analyze", (req, res) => {
  const filename = String(req.body?.filename || "reference.mp3");
  res.json(analyzeReference(filename, catalog));
});

// --- Cover concept ---
app.post("/api/cover", (req, res) => {
  res.json(buildCoverConcept(req.body || {}));
});

app.listen(PORT, () => {
  console.log(`SiliconSense clone running at http://localhost:${PORT}`);
});

export default app;
