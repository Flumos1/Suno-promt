import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const catalog = JSON.parse(readFileSync(new URL("../data/artists.json", import.meta.url), "utf8"));

test("every catalog style has a distinct, usable production prompt", () => {
  assert.equal(catalog.length, 811);
  assert.equal(new Set(catalog.map(a => a.id)).size, catalog.length);
  assert.equal(new Set(catalog.map(a => a.prompt.toLocaleLowerCase())).size, catalog.length);
  for (const artist of catalog) {
    const words = artist.prompt.trim().split(/\s+/);
    assert.ok(words.length >= 38 && words.length <= 95, `${artist.id}: ${words.length} words`);
    assert.doesNotMatch(artist.prompt, /\b\d{2,3}\s*BPM\b/i, `${artist.id}: invented exact BPM`);
    assert.doesNotMatch(artist.prompt, /\b[A-G](?:#|b)?\s+(?:major|minor)\b/i, `${artist.id}: invented key`);
    assert.doesNotMatch(artist.prompt, /\b(?:playlist|inspired by|sounds like)\b/i, `${artist.id}: filler`);
    assert.equal(artist.bpm, null, `${artist.id}: unverified BPM metadata`);
    assert.equal(artist.key, null, `${artist.id}: unverified key metadata`);
    assert.equal(artist.vocals, null, `${artist.id}: stale vocal metadata`);
  }
});

test("instrumental references are not forced into a vocal language", () => {
  for (const id of ["de-beethoven", "pl-chopin", "in-ravi-shankar", "en-aphex-twin"]) {
    const artist = catalog.find(a => a.id === id);
    assert.ok(artist, id);
    assert.match(artist.prompt, /instrumental/i, id);
    assert.doesNotMatch(artist.prompt, /-language vocals/i, id);
  }
});
