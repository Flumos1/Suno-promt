// Template-driven Suno-style prompt generation.
// No external API required. If you set an LLM provider in the future,
// generateArtistCard() is the single hook point to swap in a real model.

const GENRE_BANK = [
  { genre: "Synthwave", instruments: ["analog synth pads", "gated reverb drums", "FM bass", "neon arpeggios"], bpm: [100, 118], keys: ["A minor", "F# minor", "C minor"], moods: ["nostalgic", "cinematic", "driving"] },
  { genre: "Dream Pop", instruments: ["shimmering reverb guitars", "soft synth wash", "gentle drum machine", "warm bass"], bpm: [88, 110], keys: ["E major", "G major", "D major"], moods: ["hazy", "romantic", "wistful"] },
  { genre: "Indie Rock", instruments: ["jangly guitars", "live drums", "melodic bass", "tambourine"], bpm: [120, 150], keys: ["C major", "G major", "A major"], moods: ["earnest", "energetic", "bittersweet"] },
  { genre: "Hip Hop", instruments: ["boom-bap drums", "sampled soul chops", "deep bass", "vinyl crackle"], bpm: [82, 96], keys: ["F minor", "Bb minor", "G minor"], moods: ["confident", "smooth", "gritty"] },
  { genre: "Future Bass", instruments: ["supersaw chords", "sidechained bass", "trap hats", "vocal chops"], bpm: [140, 160], keys: ["G major", "D major", "B minor"], moods: ["euphoric", "bright", "energetic"] },
  { genre: "Soul", instruments: ["Hammond organ", "live drums", "horn section", "electric piano"], bpm: [78, 96], keys: ["Bb major", "Eb major", "C major"], moods: ["warm", "passionate", "uplifting"] },
  { genre: "Ambient", instruments: ["deep drones", "granular textures", "soft bells", "field recordings"], bpm: [55, 72], keys: ["E drone", "C drone", "A drone"], moods: ["meditative", "vast", "weightless"] },
  { genre: "Drum and Bass", instruments: ["fast breakbeats", "reese bass", "atmospheric pads", "amen breaks"], bpm: [172, 176], keys: ["F minor", "D minor", "G minor"], moods: ["urgent", "dark", "propulsive"] }
];

const VOCAL_TIMBRE = ["bright", "warm", "breathy", "gritty", "smooth", "nasal", "rich", "metallic"];
const VOCAL_DELIVERY = ["intimate close-mic", "belting", "whispered", "rap cadence", "operatic", "conversational", "shouted", "crooned"];
const VOCAL_TEXTURE = ["clean", "lightly distorted", "auto-tuned", "vocoded", "doubled and layered", "heavy reverb", "dry and present", "tape-saturated"];
const VOCAL_AGE = ["youthful", "mature", "ageless", "weathered", "childlike"];
const VOCAL_PITCH = ["low bass", "baritone", "tenor", "alto", "soprano", "falsetto"];

function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function pick(arr, seed) {
  return arr[seed % arr.length];
}

function randBetween([min, max], seed) {
  return min + (seed % (max - min + 1));
}

// Deterministically generate a plausible artist card for a name not in the catalog.
export function generateArtistCard(name) {
  const seed = hashString(name.toLowerCase().trim());
  const g = pick(GENRE_BANK, seed);
  const bpm = randBetween(g.bpm, seed >> 2);
  const key = pick(g.keys, seed >> 3);
  const mood = [pick(g.moods, seed), pick(g.moods, seed >> 4), pick(g.moods, seed >> 6)]
    .filter((v, i, a) => a.indexOf(v) === i);
  const pitch = pick(VOCAL_PITCH, seed >> 5);
  const timbre = pick(VOCAL_TIMBRE, seed >> 7);
  const delivery = pick(VOCAL_DELIVERY, seed >> 8);
  const texture = pick(VOCAL_TEXTURE, seed >> 9);
  const vocals = `${timbre} ${pitch} vocals, ${delivery}, ${texture}`;

  const prompt = `${g.genre.toLowerCase()}, ${vocals}, ${g.instruments.join(", ")}, ${mood.join(" and ")}, ${bpm} BPM, ${key}`;

  return {
    id: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
    name,
    genre: g.genre,
    era: "AI-generated",
    mood,
    bpm,
    key,
    vocals,
    instruments: g.instruments,
    prompt,
    tags: [g.genre.toLowerCase(), ...mood],
    generated: true
  };
}

// Build a vocal anchor prompt from the 5 axes (+ optional donor).
export function buildVocalAnchor({ timbre, delivery, texture, age, pitch, donor }) {
  const parts = [];
  if (pitch) parts.push(pitch);
  if (age) parts.push(age);
  if (timbre) parts.push(`${timbre} timbre`);
  parts.push("vocals");
  const tail = [];
  if (delivery) tail.push(delivery);
  if (texture) tail.push(texture);

  let anchor = `${parts.join(" ")}${tail.length ? ", " + tail.join(", ") : ""}`;
  if (donor && donor.trim()) {
    anchor += `, in the vocal spirit of ${donor.trim()} (no direct imitation)`;
  }
  return {
    anchor,
    axes: { timbre, delivery, texture, age, pitch, donor: donor || null },
    suno: `[Vocal anchor] ${anchor}`
  };
}

// Mock reference (mp3) analysis. Deterministic from filename so results are stable.
export function analyzeReference(filename, catalog) {
  const seed = hashString((filename || "reference").toLowerCase());
  const g = pick(GENRE_BANK, seed);
  const decades = ["1970s", "1980s", "1990s", "2000s", "2010s", "modern"];
  const era = pick(decades, seed >> 3);
  const bpm = randBetween(g.bpm, seed >> 2);
  const key = pick(g.keys, seed >> 5);
  const pitch = pick(VOCAL_PITCH, seed >> 6);
  const timbre = pick(VOCAL_TIMBRE, seed >> 7);

  const prompt = `${g.genre.toLowerCase()}, ${era} production, ${timbre} ${pitch} lead vocals, ${g.instruments.join(", ")}, ${bpm} BPM, ${key}`;

  // Closest catalog artists: rank by simple genre/mood overlap, fall back to seed.
  const scored = catalog
    .map((a) => {
      let score = 0;
      if (a.genre.toLowerCase().includes(g.genre.toLowerCase().split(" ")[0])) score += 5;
      (a.instruments || []).forEach((inst) => {
        if (g.instruments.some((gi) => gi.split(" ").some((w) => inst.includes(w)))) score += 1;
      });
      score += (hashString(a.id + filename) % 3);
      return { artist: a, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((s) => ({ id: s.artist.id, name: s.artist.name, genre: s.artist.genre }));

  return {
    filename,
    detected: {
      era,
      genre: g.genre,
      bpm,
      key,
      instruments: g.instruments,
      vocals: `${timbre} ${pitch}`
    },
    prompt,
    closest: scored
  };
}

// Album cover concept generator (returns a textual concept + palette for a 2048x2048 cover).
export function buildCoverConcept({ title, artist, genre, withLogo }) {
  const seed = hashString(`${title}|${artist}|${genre}`);
  const palettes = [
    ["#0f0c29", "#302b63", "#24c6dc"],
    ["#200122", "#6f0000", "#ff512f"],
    ["#000428", "#004e92", "#a8ff78"],
    ["#1a2a6c", "#b21f1f", "#fdbb2d"],
    ["#0b0b0d", "#3a1c71", "#d76d77"]
  ];
  const styles = [
    "neon-lit retro-futurist grid horizon",
    "high-contrast brutalist typographic poster",
    "dreamy gradient mesh with soft grain",
    "glitched chrome 3D lettering",
    "minimal photographic close-up with bold title"
  ];
  const palette = pick(palettes, seed);
  const style = pick(styles, seed >> 3);
  const concept = `2048x2048 album cover for "${title}" by ${artist}. ${genre} aesthetic, ${style}, ${withLogo ? "with a clean wordmark logo of the artist name" : "no text overlay beyond the title"}, balanced composition safe for Spotify / Apple Music / Yandex thumbnails.`;
  return { title, artist, genre, palette, style, concept, withLogo: !!withLogo };
}
