// Build-time catalog generator.
// Produces a large, filterable catalog of STYLE entries across language/region,
// genre, sub-genre and era — each with a 60-90 word Suno-style prompt.
// Names are evocative *style* names (region + descriptor + genre), not real
// people, which keeps sound-descriptions honest and Suno-filter-safe.
//
//   node scripts/buildCatalog.js   ->  writes data/artists.json
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Deterministic RNG so the catalog is stable across builds.
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(20260604);
const pick = (a) => a[Math.floor(rng() * a.length)];
const pickN = (a, n) => { const c = [...a]; const o = []; while (o.length < n && c.length) o.push(c.splice(Math.floor(rng() * c.length), 1)[0]); return o; };
const between = (lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));

const LANGUAGES = [
  { code: "ru", label: "Русские", vocalNote: "Russian-language vocals", names: ["Северный", "Полночный", "Янтарный", "Невский", "Стальной", "Сибирский", "Бархатный", "Алый"] },
  { code: "en", label: "Зарубежные", vocalNote: "English-language vocals", names: ["Neon", "Velvet", "Midnight", "Golden", "Crimson", "Electric", "Hollow", "Silver"] },
  { code: "uk", label: "Украинские", vocalNote: "Ukrainian-language vocals", names: ["Київський", "Карпатський", "Степовий", "Соняшний", "Вишневий", "Дніпровський"] },
  { code: "ko", label: "Корейские", vocalNote: "Korean-language vocals", names: ["Seoul", "Hangang", "Neon Seoul", "Hallyu", "Busan", "Jeju"] },
  { code: "es", label: "Испанские", vocalNote: "Spanish-language vocals", names: ["Solar", "Carmín", "Costa", "Nocturno", "Flamenco", "Verano"] },
  { code: "pt", label: "Португальские", vocalNote: "Portuguese-language vocals", names: ["Saudade", "Atlântico", "Lisboa", "Tropical", "Coral", "Maré"] },
  { code: "ja", label: "Японские", vocalNote: "Japanese-language vocals", names: ["Tokyo", "Sakura", "Neon Shibuya", "Mizu", "Kintsugi", "Yoru"] },
  { code: "de", label: "Немецкие", vocalNote: "German-language vocals", names: ["Kraftwell", "Berlin", "Eisen", "Nacht", "Kobalt", "Stahl"] },
  { code: "fr", label: "Французские", vocalNote: "French-language vocals", names: ["Velours", "Minuit", "Café", "Lumière", "Brume", "Cobalt"] },
  { code: "uz", label: "Узбекские", vocalNote: "Uzbek-language vocals", names: ["Samarqand", "Oltin", "Bahor", "Lazurit", "Sharq", "Bulbul"] },
  { code: "in", label: "Индийские", vocalNote: "Hindi/Indian-language vocals", names: ["Saffron", "Monsoon", "Mumbai", "Raga", "Indigo", "Lotus"] },
  { code: "tr", label: "Турецкие", vocalNote: "Turkish-language vocals", names: ["Bosphor", "Anadolu", "Lale", "Gece", "Mavi", "Yıldız"] },
  { code: "tj", label: "Таджикские", vocalNote: "Tajik-language vocals", names: ["Pamir", "Zarafshon", "Lazur", "Sahar", "Kuhsor", "Anor"] }
];

const GENRES = {
  Pop: { weight: 9, descriptor: ["Dream", "Glow", "Pulse", "Bloom", "Shine", "Wave"],
    sub: ["synth-pop", "dream pop", "electro-pop", "art pop", "indie pop", "dance-pop", "city pop", "bedroom pop"],
    instruments: ["bright synth leads", "punchy drum machine", "glossy pads", "plucky bass", "shimmering guitars", "vocal chops"],
    vocals: ["polished female lead", "smooth male lead", "layered group harmonies", "airy female topline"],
    moods: ["bright", "uplifting", "romantic", "catchy", "wistful"], bpm: [100, 128], keys: ["A minor", "C major", "G major", "F major"] },
  Rock: { weight: 7, descriptor: ["Riot", "Static", "Iron", "Drive", "Ember", "Storm"],
    sub: ["indie rock", "post-punk", "alt rock", "garage rock", "shoegaze", "grunge", "art rock", "stadium rock"],
    instruments: ["jangly guitars", "driving distorted guitars", "live drums", "melodic bass", "organ swells", "tambourine"],
    vocals: ["earnest male lead", "raw female lead", "anthemic group shouts", "breathy androgynous vocals"],
    moods: ["energetic", "angsty", "bittersweet", "rebellious", "anthemic"], bpm: [110, 168], keys: ["E minor", "D major", "A major", "G major"] },
  "Hip-hop": { weight: 5, descriptor: ["Obsidian", "Concrete", "Gold", "Shadow", "Vapor", "Block"],
    sub: ["boom-bap", "trap", "lo-fi hip hop", "jazz-rap", "drill", "cloud rap", "g-funk", "conscious rap"],
    instruments: ["boom-bap drums", "booming 808s", "soul sample chops", "dusty Rhodes", "rolling hi-hats", "vinyl crackle"],
    vocals: ["confident male rap", "melodic auto-tuned rap", "smooth female flow", "spoken-word verses"],
    moods: ["confident", "moody", "smooth", "menacing", "nostalgic"], bpm: [78, 145], keys: ["F minor", "G minor", "F# minor", "Bb minor"] },
  Electronic: { weight: 5, descriptor: ["Circuit", "Halcyon", "Polar", "Volt", "Prism", "Aurora"],
    sub: ["synthwave", "future bass", "techno", "house", "trance", "drum and bass", "ambient", "nu-disco"],
    instruments: ["supersaw chords", "sidechained bass", "four-on-floor kick", "modular bleeps", "gated pads", "rolling bassline"],
    vocals: ["pitched vocal chops", "ethereal female topline", "processed vocal stabs", "instrumental"],
    moods: ["euphoric", "hypnotic", "driving", "weightless", "energetic"], bpm: [118, 174], keys: ["A minor", "F# minor", "C minor", "B minor"] },
  "Jazz/Soul": { weight: 4, descriptor: ["Honey", "Amber", "Velour", "Smoke", "Sable", "Brass"],
    sub: ["soul", "neo-soul", "funk", "jazz trio", "bossa nova", "gospel", "acid jazz", "R&B"],
    instruments: ["Hammond organ", "warm Rhodes", "horn section", "slap bass", "brushed drums", "upright bass"],
    vocals: ["belting soul vocals", "smooth falsetto", "smoky female lead", "call-and-response choir"],
    moods: ["warm", "sultry", "groovy", "uplifting", "late-night"], bpm: [76, 120], keys: ["Bb major", "Eb major", "E minor", "C major"] },
  "Folk/Ethnic": { weight: 3, descriptor: ["Emerald", "Driftwood", "Saffron", "Marigold", "Cedar", "Tide"],
    sub: ["indie folk", "celtic folk", "world fusion", "americana", "neo-traditional", "afrobeats", "flamenco fusion"],
    instruments: ["fingerpicked acoustic guitar", "fiddle", "hand percussion", "tin whistle", "banjo", "drone strings"],
    vocals: ["clear ethereal female vocals", "warm male vocals with harmony", "group folk harmonies"],
    moods: ["earthy", "yearning", "hopeful", "spiritual", "warm"], bpm: [88, 120], keys: ["D major", "G major", "A minor", "raga-based"] },
  Metal: { weight: 2, descriptor: ["Iron", "Tundra", "Obsidian", "Forge", "Ash", "Frost"],
    sub: ["symphonic metal", "black metal", "djent", "power metal", "doom", "metalcore"],
    instruments: ["down-tuned guitars", "double-kick drums", "orchestral strings", "tremolo guitars", "blast beats", "deep bass"],
    vocals: ["operatic soprano over growls", "shrieked rasping vocals", "clean-to-scream male lead"],
    moods: ["epic", "dark", "frostbitten", "triumphant", "heavy"], bpm: [140, 180], keys: ["D minor", "E minor", "C minor"] },
  Chanson: { weight: 2, descriptor: ["Noir", "Boulevard", "Lantern", "Rue", "Sepia", "Cabaret"],
    sub: ["chanson", "cabaret", "torch ballad", "accordion waltz", "noir lounge"],
    instruments: ["accordion", "intimate piano", "brushed drums", "upright bass", "muted trumpet", "nylon guitar"],
    vocals: ["dramatic theatrical vocals", "intimate crooned vocals", "weathered storyteller vocals"],
    moods: ["nostalgic", "dramatic", "intimate", "wistful", "smoky"], bpm: [80, 116], keys: ["A minor", "D minor", "E minor"] }
};

const ERAS = ["1960s", "1970s", "1980s", "1990s", "2000s", "2010s", "2020s"];
const ERA_PROD = {
  "1960s": "warm vintage tape, mono-leaning mix, plate reverb",
  "1970s": "analog warmth, live room sound, subtle tape saturation",
  "1980s": "gated reverb drums, bright chorus, wide stereo",
  "1990s": "punchy mix, sampled textures, slightly lo-fi grit",
  "2000s": "polished digital sheen, tight compression, layered production",
  "2010s": "modern loud master, crisp transients, sidechained space",
  "2020s": "hyper-clean hybrid production, deep sub, immersive width"
};
const SCENARIOS = ["late-night drive", "workout playlist", "rainy study session", "festival main stage", "cinematic trailer", "intimate cafe", "road trip", "focus & coding", "dancefloor peak", "credits roll"];
const WEIGHTED = Object.entries(GENRES).flatMap(([g, d]) => Array(d.weight).fill(g));

function buildPrompt(e, g) {
  const insts = pickN(g.instruments, 4).join(", ");
  return `${e.era} ${e.subgenre} (${e.genre.toLowerCase()}), ${e.vocals}, ${e.languageNote}, ${insts}, ${ERA_PROD[e.era]}, ${e.mood.join(" and ")} mood, fits a ${e.scenario}, ${e.bpm} BPM, ${e.key}`;
}

const catalog = [];
const seen = new Set();
for (const lang of LANGUAGES) {
  const count = lang.code === "en" || lang.code === "ru" ? 26 : 14;
  for (let i = 0; i < count; i++) {
    const genreKey = pick(WEIGHTED);
    const g = GENRES[genreKey];
    const era = pick(ERAS);
    const subgenre = pick(g.sub);
    const name = `${pick(lang.names)} ${pick(g.descriptor)}`;
    if (seen.has(name)) continue;
    seen.add(name);
    const mood = pickN(g.moods, 2);
    const entry = {
      genre: genreKey, subgenre, era, vocals: pick(g.vocals),
      languageNote: lang.vocalNote, mood,
      scenario: pick(SCENARIOS), bpm: between(g.bpm[0], g.bpm[1]), key: pick(g.keys)
    };
    const id = name.toLowerCase().replace(/[^a-z0-9а-яёіїєґ]+/gi, "-").replace(/^-|-$/g, "");
    const isNew = rng() < 0.08;
    const free = rng() < 0.28;
    catalog.push({
      id, name, language: lang.code, languageLabel: lang.label,
      genre: genreKey, subgenre, era, mood,
      scenario: entry.scenario, bpm: entry.bpm, key: entry.key,
      vocals: entry.vocals,
      prompt: buildPrompt(entry, g),
      tags: [genreKey.toLowerCase(), subgenre, era, ...mood],
      free, isNew
    });
  }
}

// Sort by name for a stable, browsable order.
catalog.sort((a, b) => a.name.localeCompare(b.name, "ru"));

const out = join(__dirname, "..", "data", "artists.json");
writeFileSync(out, JSON.stringify(catalog, null, 2) + "\n");
console.log(`Wrote ${catalog.length} catalog entries to ${out}`);
const byGenre = {};
for (const c of catalog) byGenre[c.genre] = (byGenre[c.genre] || 0) + 1;
console.log("By genre:", byGenre);
console.log("Free:", catalog.filter((c) => c.free).length, "| New:", catalog.filter((c) => c.isNew).length);
