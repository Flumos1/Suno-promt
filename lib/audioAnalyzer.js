// Real audio metadata extraction using music-metadata.
// Reads actual properties from the uploaded file (duration, bitrate, sample
// rate, channels, codec) plus any embedded ID3/Vorbis tags (genre, bpm, title).
// These real signals then feed prompt building (optionally via the LLM).

import { parseBuffer } from "music-metadata";

// Map a real bitrate / sample-rate fingerprint to a production-era guess.
function eraFromTech({ bitrate, sampleRate, codec }) {
  if (sampleRate && sampleRate >= 88200) return "modern hi-res";
  if (bitrate && bitrate >= 256000) return "modern";
  if (bitrate && bitrate >= 160000) return "2000s-2010s";
  if (codec && /mp3/i.test(codec) && bitrate && bitrate <= 128000) return "early digital / web";
  return "contemporary";
}

export async function extractAudioMeta(buffer, filename) {
  const mm = await parseBuffer(buffer, { path: filename });
  const fmt = mm.format || {};
  const common = mm.common || {};

  const meta = {
    filename,
    durationSec: fmt.duration ? Math.round(fmt.duration) : null,
    bitrate: fmt.bitrate ? Math.round(fmt.bitrate) : null,
    sampleRate: fmt.sampleRate || null,
    channels: fmt.numberOfChannels || null,
    codec: fmt.codec || fmt.container || null,
    lossless: fmt.lossless ?? null,
    // Embedded tags (may be absent)
    tagTitle: common.title || null,
    tagArtist: common.artist || null,
    tagGenre: Array.isArray(common.genre) ? common.genre.join(", ") : common.genre || null,
    tagBpm: common.bpm || null,
    tagYear: common.year || null
  };
  meta.era = eraFromTech(meta);
  return meta;
}

// Build a deterministic prompt from REAL metadata (no AI). Used as the base
// result and as a fallback when no AI provider is configured.
export function promptFromMeta(meta) {
  const bits = [];
  if (meta.tagGenre) bits.push(meta.tagGenre.toLowerCase());
  bits.push(`${meta.era} production`);
  if (meta.channels === 1) bits.push("mono image");
  else if (meta.channels >= 2) bits.push("wide stereo image");
  if (meta.lossless) bits.push("clean lossless fidelity");
  else if (meta.bitrate) bits.push(`~${Math.round(meta.bitrate / 1000)}kbps texture`);
  if (meta.tagBpm) bits.push(`${meta.tagBpm} BPM`);
  if (meta.durationSec) {
    const m = Math.floor(meta.durationSec / 60);
    const s = String(meta.durationSec % 60).padStart(2, "0");
    bits.push(`${m}:${s} runtime`);
  }
  return bits.join(", ");
}

// Heuristic "closest catalog artists" from real tags when AI is unavailable.
export function closestFromMeta(meta, catalog) {
  const genre = (meta.tagGenre || "").toLowerCase();
  const scored = catalog
    .map((a) => {
      let score = 0;
      if (genre && a.genre.toLowerCase().split(/[\s/]+/).some((w) => genre.includes(w))) score += 5;
      if (meta.tagBpm && a.bpm) score += Math.max(0, 4 - Math.abs(a.bpm - meta.tagBpm) / 10);
      // stable tie-breaker derived from the filename
      score += (hash(a.id + (meta.filename || "")) % 3);
      return { a, score };
    })
    .sort((x, y) => y.score - x.score)
    .slice(0, 3)
    .map((s) => ({ id: s.a.id, name: s.a.name, genre: s.a.genre }));
  return scored;
}

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}
