import { test } from "node:test";
import assert from "node:assert/strict";
import {
  generateArtistCard,
  buildVocalAnchor,
  analyzeReference,
  buildCoverConcept
} from "../lib/promptGenerator.js";

const catalog = [
  { id: "a", name: "Neon Velvet", genre: "Synthwave", instruments: ["analog synth pads"], mood: ["nostalgic"] },
  { id: "b", name: "Lofi Tide", genre: "Lo-fi Hip Hop", instruments: ["dusty Rhodes piano"], mood: ["calm"] },
  { id: "c", name: "Iron Cathedral", genre: "Symphonic Metal", instruments: ["double-kick drums"], mood: ["epic"] }
];

test("generateArtistCard is deterministic for the same name", () => {
  const a = generateArtistCard("Phantom Drift");
  const b = generateArtistCard("Phantom Drift");
  assert.equal(a.prompt, b.prompt);
  assert.equal(a.generated, true);
  assert.ok(a.prompt.length > 20);
});

test("generateArtistCard differs for different names", () => {
  const a = generateArtistCard("Alpha");
  const b = generateArtistCard("Omega");
  assert.notEqual(a.prompt, b.prompt);
});

test("buildVocalAnchor composes axes and donor", () => {
  const r = buildVocalAnchor({ pitch: "tenor", timbre: "warm", delivery: "crooned", donor: "a jazz singer" });
  assert.match(r.anchor, /tenor/);
  assert.match(r.anchor, /warm timbre/);
  assert.match(r.anchor, /vocal spirit of a jazz singer/);
  assert.match(r.suno, /^\[Vocal anchor\]/);
});

test("analyzeReference returns prompt and exactly 3 closest", () => {
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
