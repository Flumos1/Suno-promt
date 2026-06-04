import { test } from "node:test";
import assert from "node:assert/strict";
import {
  generateArtistCard,
  buildVocalAnchor,
  analyzeReference,
  buildCoverConcept
} from "../lib/promptGenerator.js";
import { activeProvider, aiEnabled } from "../lib/aiProvider.js";
import { extractAudioMeta, promptFromMeta, closestFromMeta } from "../lib/audioAnalyzer.js";

const catalog = [
  { id: "a", name: "Neon Velvet", genre: "Synthwave", instruments: ["analog synth pads"], mood: ["nostalgic"], bpm: 110 },
  { id: "b", name: "Lofi Tide", genre: "Lo-fi Hip Hop", instruments: ["dusty Rhodes piano"], mood: ["calm"], bpm: 78 },
  { id: "c", name: "Iron Cathedral", genre: "Symphonic Metal", instruments: ["double-kick drums"], mood: ["epic"], bpm: 145 }
];

test("generateArtistCard is deterministic for the same name", () => {
  const a = generateArtistCard("Phantom Drift");
  const b = generateArtistCard("Phantom Drift");
  assert.equal(a.prompt, b.prompt);
  assert.equal(a.generated, true);
  assert.ok(a.prompt.length > 20);
});

test("generateArtistCard differs for different names", () => {
  assert.notEqual(generateArtistCard("Alpha").prompt, generateArtistCard("Omega").prompt);
});

test("buildVocalAnchor composes axes and donor", () => {
  const r = buildVocalAnchor({ pitch: "tenor", timbre: "warm", delivery: "crooned", donor: "a jazz singer" });
  assert.match(r.anchor, /tenor/);
  assert.match(r.anchor, /warm timbre/);
  assert.match(r.anchor, /vocal spirit of a jazz singer/);
  assert.match(r.suno, /^\[Vocal anchor\]/);
});

test("analyzeReference (mock) returns prompt and exactly 3 closest", () => {
  const r = analyzeReference("track01.mp3", catalog);
  assert.ok(r.prompt.length > 10);
  assert.equal(r.closest.length, 3);
  assert.ok(r.detected.bpm > 0);
});

test("buildCoverConcept returns palette of 3 and concept text", () => {
  const r = buildCoverConcept({ title: "Voltage", artist: "Azure", genre: "synthwave", withLogo: true });
  assert.equal(r.palette.length, 3);
  assert.match(r.concept, /2048x2048/);
  assert.equal(r.withLogo, true);
});

/* ---------- AI provider ---------- */
test("activeProvider falls back to template with no keys", () => {
  const had = { a: process.env.ANTHROPIC_API_KEY, o: process.env.OPENAI_API_KEY, f: process.env.AI_PROVIDER };
  delete process.env.ANTHROPIC_API_KEY; delete process.env.OPENAI_API_KEY; delete process.env.AI_PROVIDER;
  assert.equal(activeProvider(), "template");
  assert.equal(aiEnabled(), false);
  if (had.a) process.env.ANTHROPIC_API_KEY = had.a;
  if (had.o) process.env.OPENAI_API_KEY = had.o;
  if (had.f) process.env.AI_PROVIDER = had.f;
});

/* ---------- Real audio metadata ---------- */
function makeWav({ sampleRate = 44100, channels = 1, seconds = 1 } = {}) {
  const numSamples = sampleRate * seconds * channels;
  const dataSize = numSamples * 2; // 16-bit
  const buf = Buffer.alloc(44 + dataSize);
  buf.write("RIFF", 0); buf.writeUInt32LE(36 + dataSize, 4); buf.write("WAVE", 8);
  buf.write("fmt ", 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(channels, 22); buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * channels * 2, 28); buf.writeUInt16LE(channels * 2, 32);
  buf.writeUInt16LE(16, 34); buf.write("data", 36); buf.writeUInt32LE(dataSize, 40);
  return buf;
}

test("extractAudioMeta reads real WAV properties", async () => {
  const wav = makeWav({ sampleRate: 44100, channels: 2, seconds: 2 });
  const meta = await extractAudioMeta(wav, "demo.wav");
  assert.equal(meta.sampleRate, 44100);
  assert.equal(meta.channels, 2);
  assert.equal(meta.durationSec, 2);
  assert.ok(meta.era);
});

test("promptFromMeta and closestFromMeta build from metadata", () => {
  const meta = { era: "modern", channels: 2, lossless: false, bitrate: 256000, tagGenre: "Synthwave", tagBpm: 110, durationSec: 200, filename: "x.mp3" };
  const p = promptFromMeta(meta);
  assert.match(p, /synthwave/);
  assert.match(p, /110 BPM/);
  const closest = closestFromMeta(meta, catalog);
  assert.equal(closest.length, 3);
  assert.equal(closest[0].name, "Neon Velvet"); // best genre+bpm match
});
