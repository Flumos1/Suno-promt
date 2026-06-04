// Build-time catalog generator — REAL artists.
// Each catalog entry is keyed by a real, recognisable artist name, grouped by
// language/region, genre, sub-genre and era. The generated Suno prompt
// describes the SOUND only and never names the artist, so it passes Suno's
// content filter (same idea as the original catalog).
//
//   node scripts/buildCatalog.js   ->  writes data/artists.json
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return Math.abs(h);
}
const mk = (seed) => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pick = (a, r) => a[Math.floor(r() * a.length)];
const pickN = (a, n, r) => { const c = [...a], o = []; while (o.length < n && c.length) o.push(c.splice(Math.floor(r() * c.length), 1)[0]); return o; };
const between = (lo, hi, r) => lo + Math.floor(r() * (hi - lo + 1));

const LANG_LABEL = { ru: "Русские", en: "Зарубежные", uk: "Украинские", ko: "Корейские", es: "Испанские", pt: "Португальские", ja: "Японские", de: "Немецкие", fr: "Французские", uz: "Узбекские", in: "Индийские", tr: "Турецкие", tj: "Таджикские" };
const LANG_VOCAL = { ru: "Russian-language vocals", en: "English-language vocals", uk: "Ukrainian-language vocals", ko: "Korean-language vocals", es: "Spanish-language vocals", pt: "Portuguese-language vocals", ja: "Japanese-language vocals", de: "German-language vocals", fr: "French-language vocals", uz: "Uzbek-language vocals", in: "Hindi/Indian-language vocals", tr: "Turkish-language vocals", tj: "Tajik-language vocals" };

const GENRES = {
  Pop: { instruments: ["bright synth leads", "punchy drum machine", "glossy pads", "plucky bass", "shimmering guitars", "vocal chops", "string section"], vocals: ["polished female lead", "smooth male lead", "layered group harmonies", "airy female topline"], moods: ["bright", "uplifting", "romantic", "catchy", "wistful", "glamorous"], bpm: [96, 128], keys: ["A minor", "C major", "G major", "F major", "D major"] },
  Rock: { instruments: ["jangly guitars", "driving distorted guitars", "live drums", "melodic bass", "organ swells", "tambourine"], vocals: ["earnest male lead", "raw female lead", "anthemic group shouts", "raspy male lead"], moods: ["energetic", "angsty", "bittersweet", "rebellious", "anthemic", "raw"], bpm: [108, 168], keys: ["E minor", "D major", "A major", "G major"] },
  "Hip-hop": { instruments: ["boom-bap drums", "booming 808s", "soul sample chops", "dusty Rhodes", "rolling hi-hats", "vinyl crackle"], vocals: ["confident male rap", "melodic auto-tuned rap", "smooth female flow", "double-time verses"], moods: ["confident", "moody", "smooth", "menacing", "nostalgic", "gritty"], bpm: [78, 145], keys: ["F minor", "G minor", "F# minor", "Bb minor"] },
  Electronic: { instruments: ["supersaw chords", "sidechained bass", "four-on-floor kick", "modular bleeps", "gated pads", "rolling bassline", "arpeggiated synths"], vocals: ["pitched vocal chops", "ethereal female topline", "processed vocal stabs", "robotic vocoder"], moods: ["euphoric", "hypnotic", "driving", "weightless", "energetic", "cold"], bpm: [110, 140], keys: ["A minor", "F# minor", "C minor", "B minor"] },
  "Jazz/Soul": { instruments: ["Hammond organ", "warm Rhodes", "horn section", "slap bass", "brushed drums", "upright bass", "nylon guitar"], vocals: ["belting soul vocals", "smooth falsetto", "smoky female lead", "call-and-response choir"], moods: ["warm", "sultry", "groovy", "uplifting", "late-night", "smooth"], bpm: [72, 120], keys: ["Bb major", "Eb major", "E minor", "C major"] },
  "Folk/Ethnic": { instruments: ["fingerpicked acoustic guitar", "fiddle", "hand percussion", "tin whistle", "frame drum", "drone strings", "traditional flute"], vocals: ["clear ethereal female vocals", "warm male vocals with harmony", "group folk harmonies", "ornamented melismatic vocals"], moods: ["earthy", "yearning", "hopeful", "spiritual", "warm", "rousing"], bpm: [84, 124], keys: ["D major", "G major", "A minor", "modal"] },
  Metal: { instruments: ["down-tuned guitars", "double-kick drums", "orchestral strings", "tremolo guitars", "blast beats", "deep bass"], vocals: ["operatic soprano over growls", "shrieked rasping vocals", "clean-to-scream male lead", "powerful clean male lead"], moods: ["epic", "dark", "aggressive", "triumphant", "heavy"], bpm: [130, 180], keys: ["D minor", "E minor", "C minor"] },
  Chanson: { instruments: ["accordion", "intimate piano", "brushed drums", "upright bass", "muted trumpet", "nylon guitar", "string quartet"], vocals: ["dramatic theatrical vocals", "intimate crooned vocals", "weathered storyteller vocals"], moods: ["nostalgic", "dramatic", "intimate", "wistful", "smoky"], bpm: [80, 116], keys: ["A minor", "D minor", "E minor"] }
};
const ERA_PROD = { "1960s": "warm vintage tape and plate reverb", "1970s": "analog warmth and live-room sound", "1980s": "gated reverb drums, bright chorus, wide stereo", "1990s": "punchy mix with sampled textures", "2000s": "polished digital sheen and tight compression", "2010s": "modern loud master with crisp transients", "2020s": "hyper-clean hybrid production with deep sub" };
const SCENARIOS = ["late-night drive", "workout playlist", "rainy study session", "festival main stage", "cinematic trailer", "intimate venue", "road trip", "dancefloor peak"];

// Real artists: [name, genreBucket, subgenre, era]
const SEED = {
  en: [
    ["2Pac", "Hip-hop", "west-coast hip-hop", "1990s"], ["50 Cent", "Hip-hop", "gangsta rap", "2000s"],
    ["ABBA", "Pop", "europop", "1970s"], ["a-ha", "Pop", "synth-pop", "1980s"], ["AC/DC", "Rock", "hard rock", "1980s"],
    ["Adele", "Pop", "soul-pop", "2010s"], ["Amy Winehouse", "Jazz/Soul", "neo-soul", "2000s"], ["Arctic Monkeys", "Rock", "indie rock", "2010s"],
    ["The Beatles", "Rock", "pop-rock", "1960s"], ["Beyoncé", "Pop", "R&B-pop", "2010s"], ["Billie Eilish", "Pop", "dark pop", "2010s"],
    ["Bob Dylan", "Folk/Ethnic", "folk rock", "1960s"], ["Bob Marley", "Folk/Ethnic", "roots reggae", "1970s"], ["Coldplay", "Rock", "alt rock", "2000s"],
    ["Daft Punk", "Electronic", "french house", "2000s"], ["David Bowie", "Rock", "art rock", "1970s"], ["Depeche Mode", "Electronic", "synth-pop", "1980s"],
    ["Dr. Dre", "Hip-hop", "g-funk", "1990s"], ["Dua Lipa", "Pop", "nu-disco pop", "2020s"], ["Eminem", "Hip-hop", "rap", "2000s"],
    ["Fleetwood Mac", "Rock", "soft rock", "1970s"], ["Guns N' Roses", "Rock", "hard rock", "1980s"], ["Iron Maiden", "Metal", "heavy metal", "1980s"],
    ["Jimi Hendrix", "Rock", "psychedelic rock", "1960s"], ["Kanye West", "Hip-hop", "hip-hop", "2000s"], ["Kendrick Lamar", "Hip-hop", "conscious rap", "2010s"],
    ["Lady Gaga", "Pop", "dance-pop", "2010s"], ["Lana Del Rey", "Pop", "dream pop", "2010s"], ["Led Zeppelin", "Rock", "hard rock", "1970s"],
    ["Madonna", "Pop", "dance-pop", "1980s"], ["Metallica", "Metal", "thrash metal", "1980s"], ["Michael Jackson", "Pop", "pop", "1980s"],
    ["Nas", "Hip-hop", "boom-bap", "1990s"], ["Nirvana", "Rock", "grunge", "1990s"], ["Oasis", "Rock", "britpop", "1990s"],
    ["Pink Floyd", "Rock", "progressive rock", "1970s"], ["Prince", "Jazz/Soul", "funk", "1980s"], ["Queen", "Rock", "arena rock", "1970s"],
    ["Radiohead", "Rock", "alt rock", "1990s"], ["Red Hot Chili Peppers", "Rock", "funk rock", "1990s"], ["Rihanna", "Pop", "R&B-pop", "2010s"],
    ["The Rolling Stones", "Rock", "rock'n'roll", "1960s"], ["Snoop Dogg", "Hip-hop", "g-funk", "1990s"], ["Stevie Wonder", "Jazz/Soul", "soul", "1970s"],
    ["Taylor Swift", "Pop", "pop", "2010s"], ["The Cure", "Rock", "post-punk", "1980s"], ["The Weeknd", "Pop", "alt-R&B", "2010s"],
    ["Tina Turner", "Jazz/Soul", "soul rock", "1980s"], ["U2", "Rock", "arena rock", "1980s"], ["Whitney Houston", "Jazz/Soul", "soul-pop", "1980s"]
  ],
  ru: [
    ["Кино", "Rock", "post-punk", "1980s"], ["ДДТ", "Rock", "rock", "1990s"], ["Алиса", "Rock", "rock", "1980s"],
    ["Ария", "Metal", "heavy metal", "1980s"], ["Земфира", "Rock", "alt rock", "2000s"], ["Би-2", "Rock", "alt rock", "2000s"],
    ["Сплин", "Rock", "alt rock", "2000s"], ["Мумий Тролль", "Rock", "indie rock", "1990s"], ["Ленинград", "Rock", "ska-punk", "2000s"],
    ["Аквариум", "Rock", "art rock", "1980s"], ["Машина Времени", "Rock", "rock", "1970s"], ["Наутилус Помпилиус", "Rock", "post-punk", "1980s"],
    ["Гражданская оборона", "Rock", "punk", "1990s"], ["Король и Шут", "Rock", "horror punk", "2000s"], ["Сектор Газа", "Rock", "punk", "1990s"],
    ["Звери", "Rock", "pop-rock", "2000s"], ["Баста", "Hip-hop", "rap", "2010s"], ["Каста", "Hip-hop", "hip-hop", "2000s"],
    ["Oxxxymiron", "Hip-hop", "rap", "2010s"], ["Макс Корж", "Hip-hop", "pop-rap", "2010s"], ["Скриптонит", "Hip-hop", "cloud rap", "2010s"],
    ["Моргенштерн", "Hip-hop", "trap", "2020s"], ["Тату", "Pop", "pop", "2000s"], ["Алла Пугачёва", "Pop", "estrada", "1980s"],
    ["Дима Билан", "Pop", "pop", "2000s"], ["Полина Гагарина", "Pop", "pop", "2010s"], ["Мираж", "Pop", "synth-pop", "1980s"],
    ["Монеточка", "Pop", "indie pop", "2010s"], ["IC3PEAK", "Electronic", "dark electronic", "2010s"], ["Little Big", "Electronic", "rave-pop", "2010s"],
    ["Кипелов", "Metal", "heavy metal", "2000s"], ["Гражданин", "Hip-hop", "rap", "2010s"], ["Кровосток", "Hip-hop", "hardcore rap", "2000s"],
    ["Чайф", "Rock", "rock", "1990s"]
  ],
  uk: [
    ["Океан Ельзи", "Rock", "alt rock", "2000s"], ["ДахаБраха", "Folk/Ethnic", "ethno-chaos", "2010s"], ["Go_A", "Folk/Ethnic", "electro-folk", "2020s"],
    ["Скрябін", "Pop", "synth-pop", "2000s"], ["ТНМК", "Hip-hop", "hip-hop", "2000s"], ["Бумбокс", "Rock", "funk rock", "2000s"],
    ["Воплі Відоплясова", "Rock", "folk punk", "1990s"], ["KAZKA", "Pop", "ethno-pop", "2010s"], ["alyona alyona", "Hip-hop", "rap", "2020s"],
    ["Jamala", "Jazz/Soul", "soul", "2010s"], ["The Hardkiss", "Rock", "art rock", "2010s"], ["MONATIK", "Pop", "dance-pop", "2010s"],
    ["Тіна Кароль", "Pop", "pop", "2010s"], ["Антитіла", "Rock", "pop-rock", "2010s"]
  ],
  ko: [
    ["BTS", "Pop", "k-pop", "2010s"], ["BLACKPINK", "Pop", "k-pop", "2010s"], ["EXO", "Pop", "k-pop", "2010s"],
    ["TWICE", "Pop", "k-pop", "2010s"], ["Red Velvet", "Pop", "k-pop", "2010s"], ["BIGBANG", "Pop", "k-pop", "2010s"],
    ["IU", "Pop", "k-ballad", "2010s"], ["PSY", "Pop", "k-pop", "2010s"], ["G-Dragon", "Hip-hop", "k-rap", "2010s"],
    ["Stray Kids", "Pop", "k-pop", "2020s"], ["NewJeans", "Pop", "k-pop", "2020s"], ["aespa", "Pop", "k-pop", "2020s"]
  ],
  ja: [
    ["YOASOBI", "Pop", "j-pop", "2020s"], ["Hikaru Utada", "Pop", "j-pop", "2000s"], ["X Japan", "Metal", "power metal", "1990s"],
    ["Babymetal", "Metal", "kawaii metal", "2010s"], ["Perfume", "Electronic", "techno-pop", "2000s"], ["ONE OK ROCK", "Rock", "alt rock", "2010s"],
    ["Kenshi Yonezu", "Pop", "j-pop", "2010s"], ["Ado", "Pop", "j-pop", "2020s"], ["L'Arc-en-Ciel", "Rock", "j-rock", "1990s"],
    ["Ryuichi Sakamoto", "Electronic", "ambient", "1980s"], ["Mariya Takeuchi", "Pop", "city pop", "1980s"], ["RADWIMPS", "Rock", "alt rock", "2010s"]
  ],
  es: [
    ["Rosalía", "Pop", "flamenco-pop", "2010s"], ["Enrique Iglesias", "Pop", "latin pop", "2000s"], ["Shakira", "Pop", "latin pop", "2000s"],
    ["Manu Chao", "Folk/Ethnic", "latin alternative", "1990s"], ["Héroes del Silencio", "Rock", "rock", "1990s"], ["Mecano", "Pop", "synth-pop", "1980s"],
    ["Alejandro Sanz", "Pop", "latin pop", "2000s"], ["Paco de Lucía", "Folk/Ethnic", "flamenco", "1970s"], ["C. Tangana", "Hip-hop", "latin trap", "2020s"],
    ["Bad Bunny", "Hip-hop", "reggaeton", "2020s"], ["Daddy Yankee", "Hip-hop", "reggaeton", "2000s"], ["Joaquín Sabina", "Chanson", "spanish chanson", "1990s"]
  ],
  pt: [
    ["Anitta", "Pop", "funk carioca", "2010s"], ["Caetano Veloso", "Folk/Ethnic", "MPB", "1970s"], ["Gilberto Gil", "Folk/Ethnic", "MPB", "1970s"],
    ["Tom Jobim", "Jazz/Soul", "bossa nova", "1960s"], ["João Gilberto", "Jazz/Soul", "bossa nova", "1960s"], ["Seu Jorge", "Folk/Ethnic", "samba-soul", "2000s"],
    ["Marisa Monte", "Pop", "MPB", "1990s"], ["Sepultura", "Metal", "thrash metal", "1990s"], ["Mariza", "Folk/Ethnic", "fado", "2000s"],
    ["Madredeus", "Folk/Ethnic", "fado", "1990s"], ["Os Mutantes", "Rock", "psychedelic", "1960s"], ["Legião Urbana", "Rock", "rock", "1980s"]
  ],
  de: [
    ["Rammstein", "Metal", "industrial metal", "1990s"], ["Kraftwerk", "Electronic", "electro", "1970s"], ["Scorpions", "Rock", "hard rock", "1980s"],
    ["Nena", "Pop", "neue deutsche welle", "1980s"], ["Tokio Hotel", "Rock", "pop-rock", "2000s"], ["Modern Talking", "Pop", "euro-disco", "1980s"],
    ["Falco", "Pop", "pop-rap", "1980s"], ["Die Toten Hosen", "Rock", "punk rock", "1990s"], ["Paul Kalkbrenner", "Electronic", "techno", "2010s"],
    ["Robin Schulz", "Electronic", "deep house", "2010s"], ["Cro", "Hip-hop", "pop-rap", "2010s"], ["Helene Fischer", "Pop", "schlager", "2010s"]
  ],
  fr: [
    ["Édith Piaf", "Chanson", "chanson", "1960s"], ["Charles Aznavour", "Chanson", "chanson", "1960s"], ["Serge Gainsbourg", "Chanson", "chanson", "1970s"],
    ["Stromae", "Pop", "electro-pop", "2010s"], ["Indila", "Pop", "pop", "2010s"], ["Christine and the Queens", "Pop", "art pop", "2010s"],
    ["Air", "Electronic", "downtempo", "1990s"], ["Justice", "Electronic", "electro house", "2000s"], ["Mylène Farmer", "Pop", "synth-pop", "1990s"],
    ["Gojira", "Metal", "progressive metal", "2010s"], ["David Guetta", "Electronic", "EDM", "2010s"], ["MC Solaar", "Hip-hop", "french rap", "1990s"], ["Zaz", "Jazz/Soul", "jazz-pop", "2010s"]
  ],
  uz: [
    ["Yulduz Usmonova", "Pop", "uzbek pop", "2000s"], ["Sevara Nazarkhan", "Folk/Ethnic", "uzbek world", "2000s"], ["Sherali Jo'rayev", "Folk/Ethnic", "uzbek estrada", "1980s"],
    ["Shahzoda", "Pop", "uzbek pop", "2000s"], ["Rayhon", "Pop", "uzbek pop", "2010s"], ["Ozodbek Nazarbekov", "Pop", "uzbek estrada", "2000s"],
    ["Ulug'bek Rahmatullayev", "Pop", "uzbek pop", "2010s"], ["Munisa Rizayeva", "Pop", "uzbek pop", "2010s"], ["Bojalar", "Pop", "uzbek pop", "2010s"], ["Lola", "Pop", "uzbek pop", "2000s"]
  ],
  in: [
    ["A. R. Rahman", "Folk/Ethnic", "bollywood fusion", "2000s"], ["Lata Mangeshkar", "Pop", "playback", "1970s"], ["Kishore Kumar", "Pop", "playback", "1970s"],
    ["Arijit Singh", "Pop", "bollywood", "2010s"], ["Nusrat Fateh Ali Khan", "Folk/Ethnic", "qawwali", "1990s"], ["Ravi Shankar", "Folk/Ethnic", "hindustani classical", "1960s"],
    ["Diljit Dosanjh", "Pop", "bhangra-pop", "2010s"], ["Badshah", "Hip-hop", "desi hip-hop", "2010s"], ["Shreya Ghoshal", "Pop", "bollywood", "2000s"],
    ["Asha Bhosle", "Pop", "playback", "1970s"], ["Divine", "Hip-hop", "gully rap", "2010s"], ["Sonu Nigam", "Pop", "bollywood", "2000s"]
  ],
  tr: [
    ["Tarkan", "Pop", "turkish pop", "1990s"], ["Sezen Aksu", "Pop", "turkish pop", "1980s"], ["Barış Manço", "Rock", "anatolian rock", "1970s"],
    ["maNga", "Rock", "nu metal", "2000s"], ["Sertab Erener", "Pop", "pop", "2000s"], ["Müslüm Gürses", "Folk/Ethnic", "arabesque", "1980s"],
    ["Ajda Pekkan", "Pop", "pop", "1970s"], ["Mor ve Ötesi", "Rock", "alt rock", "2000s"], ["Sıla", "Pop", "pop", "2010s"], ["Mabel Matiz", "Pop", "art pop", "2010s"]
  ],
  tj: [
    ["Daler Nazarov", "Folk/Ethnic", "tajik folk-rock", "1990s"], ["Shabnami Surayo", "Pop", "tajik pop", "2010s"], ["Noziya Karomatullo", "Pop", "tajik pop", "2010s"],
    ["Tahmina Niyazova", "Pop", "tajik pop", "2010s"], ["Sadriddin Najmiddin", "Pop", "tajik pop", "2010s"], ["Manija Davlatova", "Pop", "tajik pop", "2010s"],
    ["Parviz Nazarov", "Pop", "tajik pop", "2010s"], ["Firdavs Davlatov", "Pop", "tajik pop", "2020s"]
  ]
};

function buildPrompt(name, lang, genreKey, subgenre, era) {
  const r = mk(hash(name));
  const g = GENRES[genreKey];
  const vocals = pick(g.vocals, r);
  const insts = pickN(g.instruments, 4, r).join(", ");
  const mood = pickN(g.moods, 2, r);
  const bpm = between(g.bpm[0], g.bpm[1], r);
  const key = pick(g.keys, r);
  const scenario = pick(SCENARIOS, r);
  const prompt = `${era} ${subgenre} (${genreKey.toLowerCase()}), ${vocals}, ${LANG_VOCAL[lang]}, ${insts}, ${ERA_PROD[era]}, ${mood.join(" and ")} mood, fits a ${scenario}, ${bpm} BPM, ${key}`;
  return { prompt, mood, bpm, key, vocals, scenario, r };
}

const catalog = [];
for (const [lang, list] of Object.entries(SEED)) {
  for (const [name, genreKey, subgenre, era] of list) {
    const { prompt, mood, bpm, key, vocals, r } = buildPrompt(name, lang, genreKey, subgenre, era);
    const id = `${lang}-${name}`.toLowerCase().replace(/[^a-z0-9а-яёіїєґ]+/gi, "-").replace(/^-|-$/g, "");
    catalog.push({
      id, name, language: lang, languageLabel: LANG_LABEL[lang],
      genre: genreKey, subgenre, era, mood, bpm, key, vocals, prompt,
      tags: [genreKey.toLowerCase(), subgenre, era, ...mood],
      free: r() < 0.3, isNew: r() < 0.08
    });
  }
}
catalog.sort((a, b) => a.name.localeCompare(b.name, "en"));

const out = join(__dirname, "..", "data", "artists.json");
writeFileSync(out, JSON.stringify(catalog, null, 2) + "\n");
const byGenre = {}; for (const c of catalog) byGenre[c.genre] = (byGenre[c.genre] || 0) + 1;
const byLang = {}; for (const c of catalog) byLang[c.language] = (byLang[c.language] || 0) + 1;
console.log(`Wrote ${catalog.length} real-artist entries to ${out}`);
console.log("By genre:", byGenre);
console.log("By language:", byLang);
console.log("Free:", catalog.filter((c) => c.free).length, "| New:", catalog.filter((c) => c.isNew).length);
