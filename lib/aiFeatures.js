// Wave 1 AI features: text-in/text-out + vision.
// All functions return { ok: true, ... } or { ok: false, error, fallback? }.

import { llmJSON, llmVisionJSON, aiEnabled } from "./aiProvider.js";
import { Readable } from "node:stream";

// ─── #1 RU → EN Mirror Mode ──────────────────────────────────────────────
// Translate Russian lyrics to English while preserving rhyme + syllable count
// so Suno renders cleaner phonetics. Returns both versions.

const TRANSLATE_SYSTEM =
  "You are a bilingual lyric translator for Suno AI prompts. " +
  "Convert Russian lyrics to singable English while preserving line count, " +
  "approximate syllable count, and rhyme scheme. Do not paraphrase the theme — " +
  "stay close to the imagery. Keep [Section] tags untouched. " +
  "Reply with JSON only, no commentary.";

export async function translateLyricsRuToEn(russianText) {
  if (!aiEnabled()) {
    return { ok: false, error: "AI provider not configured", fallback: russianText };
  }
  const user =
    `Translate these Russian lyrics to singable English. Preserve line breaks, ` +
    `section tags like [Verse 1], rhyme scheme, and syllable count where possible.\n\n` +
    `Russian:\n${russianText}\n\n` +
    `Respond JSON: {"english": string, "rhymeNotes": string, "syllablesMatched": boolean}.`;
  const json = await llmJSON(TRANSLATE_SYSTEM, user, 1500);
  if (!json?.english) return { ok: false, error: "AI returned no translation" };
  return {
    ok: true,
    english: json.english,
    rhymeNotes: json.rhymeNotes || "",
    syllablesMatched: !!json.syllablesMatched,
    original: russianText
  };
}

// ─── #2 Cinematic Scene → Score ──────────────────────────────────────────
// Free-text scene description (RU or EN) → cinematic Suno prompt + section
// structure with [Intro]/[Build]/[Drop]/[Outro] tags.

const SCENE_SYSTEM =
  "You are a film-score composer translating cinematic scenes into Suno AI v5.5 prompts. " +
  "Output a tight 8-15 token style prompt (genre, instruments, mood, tempo, key) " +
  "plus a Suno lyrics-field structure block with [Section] tags. " +
  "Never name real artists. Reply JSON only.";

export async function sceneToScore(sceneText, options = {}) {
  if (!aiEnabled()) return { ok: false, error: "AI provider not configured" };
  const lang = options.lang || "auto";
  const user =
    `Scene: ${sceneText}\n\n` +
    `Build a Suno prompt that scores this scene. Pick instruments and mood that fit ` +
    `the visual; specify tempo (BPM) and key. Then write a structure block with ` +
    `4-6 [Section] tags (Intro, Build, Drop / Climax, Bridge, Outro as relevant) — ` +
    `each tag on its own line with a one-line direction.\n\n` +
    `Output language for "structure" directions: ${lang === "ru" ? "Russian" : "English"}.\n\n` +
    `Respond JSON: {"prompt": string, "structure": string, "bpm": number, "key": string, "mood": string[], "instruments": string[]}.`;
  const json = await llmJSON(SCENE_SYSTEM, user, 1000);
  if (!json?.prompt) return { ok: false, error: "AI returned no prompt" };
  return {
    ok: true,
    prompt: json.prompt,
    structure: json.structure || "",
    bpm: json.bpm || null,
    key: json.key || "",
    mood: Array.isArray(json.mood) ? json.mood : [],
    instruments: Array.isArray(json.instruments) ? json.instruments : []
  };
}

// ─── #7 Style Time Machine ───────────────────────────────────────────────
// Cross-era mashup: artist signature × production palette of another decade.

const TIME_MACHINE_SYSTEM =
  "You are a music producer specializing in cross-era genre fusion. " +
  "Given an artist name and a target era, you create a Suno AI v5.5 style prompt " +
  "that captures the artist's CORE signature (vocal character, emotional tone, " +
  "lyrical themes, melodic sensibility) BUT transplants it into the production " +
  "aesthetics of the target era (era-specific instruments, mixing techniques, " +
  "studio technology, fashion of sounds). " +
  "Never name real artists. Reply JSON only.";

export async function styleTimeMachine(artistName, targetEra, opts = {}) {
  if (!aiEnabled()) return { ok: false, error: "AI provider not configured" };
  const user =
    `Artist: "${artistName}"\n` +
    `Target era: ${targetEra}\n` +
    `${opts.note ? `Extra context: ${opts.note}\n` : ""}` +
    `\nDescribe what this artist would sound like in ${targetEra}. ` +
    `Keep their core identity but use ONLY production tools, instruments, and mixing ` +
    `conventions that existed/were popular in ${targetEra}. ` +
    `Be specific about sounds — name actual instruments, drum machines, synths of that era.\n\n` +
    `Respond JSON:\n` +
    `{"concept": string, "prompt": string, "era_instruments": string[], ` +
    `"era_production": string, "retained_from_artist": string[], ` +
    `"bpm": number|null, "key": string, "mood": string[]}`;

  const json = await llmJSON(TIME_MACHINE_SYSTEM, user, 900);
  if (!json?.prompt) return { ok: false, error: "AI returned no result" };
  return {
    ok: true,
    artist: artistName,
    targetEra,
    concept: json.concept || "",
    prompt: json.prompt,
    eraInstruments: Array.isArray(json.era_instruments) ? json.era_instruments : [],
    eraProduction: json.era_production || "",
    retainedFromArtist: Array.isArray(json.retained_from_artist) ? json.retained_from_artist : [],
    bpm: json.bpm || null,
    key: json.key || "",
    mood: Array.isArray(json.mood) ? json.mood : []
  };
}

// ─── #8 Lyrics Sync Conductor ────────────────────────────────────────────
// Insert Suno inline tags at the right emotional moments in user's lyrics.

const LYRICS_SYNC_SYSTEM =
  "You are a Suno AI v5.5 lyrics engineer. " +
  "Suno's lyrics field accepts inline tags like [High Energy], [Vocal: raspy], " +
  "[Guitar Solo], [Soft], [Build], [Drop], [Anthemic], [Whispered], [Ad lib], " +
  "[Instrumental Break], [Key Change], [Outro], [Verse], [Chorus], [Bridge], [Pre-Chorus]. " +
  "These tags are read inline and override the mood/energy at that exact moment — " +
  "they are ~10× more powerful than the style field. " +
  "CRITICAL: ALL tags MUST be in English, regardless of the lyrics language. " +
  "Russian lyrics get English tags. Korean lyrics get English tags. Always. " +
  "Your job: insert the RIGHT tags at the RIGHT moments in the provided lyrics " +
  "based on the emotional arc. Don't over-tag (max 1 tag per 4 lines). " +
  "Keep original text exactly unchanged — only insert tags on their own lines. " +
  "Reply JSON only.";

export async function lyricsSyncConduct(lyrics, style = "") {
  if (!aiEnabled()) return { ok: false, error: "AI provider not configured" };
  const user =
    `Style/genre: ${style || "not specified"}\n\n` +
    `Lyrics:\n${lyrics}\n\n` +
    `Insert inline Suno tags at the right moments. ` +
    `Rules: tags go on their OWN line, surrounded by the lyrics. ` +
    `Don't tag more than once every 4 lines. ` +
    `Use section tags [Verse 1], [Chorus], [Bridge] etc. if missing. ` +
    `Explain each tag you added.\n\n` +
    `IMPORTANT: every [Tag] must be in English. The lyrics text stays in its original language.\n\n` +
    `Respond JSON:\n` +
    `{"tagged": string, "tags_added": [{"tag": string, "line_after": string, "why": string}], ` +
    `"tip": string}`;

  const json = await llmJSON(LYRICS_SYNC_SYSTEM, user, 2000);
  if (!json?.tagged) return { ok: false, error: "AI returned no result" };
  return {
    ok: true,
    tagged: json.tagged,
    tagsAdded: Array.isArray(json.tags_added) ? json.tags_added : [],
    tip: json.tip || ""
  };
}

// ─── #6 Track DNA Decoder ────────────────────────────────────────────────
// Upload audio → Whisper lyrics + music-metadata → Claude producer report
// + top-3 catalog matches + ready Suno prompt.

const DNA_SYSTEM =
  "You are a professional music producer and sound designer. " +
  "Your job: analyse a track's metadata + lyrics and write a concise ' Track DNA' report " +
  "that helps recreate the vibe in Suno AI v5.5. " +
  "Identify the era, genre, production style, vocal character, key instruments, " +
  "mood and tempo. Then pick the 3 best matching artists from the provided catalog. " +
  "Finally, write ONE tight Suno style prompt (≤90 chars, no artist names). " +
  "Reply JSON only.";

export async function decodeDNA(meta, transcriptText, catalogNames) {
  if (!aiEnabled()) return { ok: false, error: "AI provider not configured" };

  const lyricsSection = transcriptText
    ? `\n\nTranscribed lyrics (first 600 chars):\n"${transcriptText.slice(0, 600)}"`
    : "\n\n(No lyrics / instrumental)";

  const user =
    `Audio metadata:\n${JSON.stringify(meta, null, 2)}${lyricsSection}\n\n` +
    `Catalog of 747 artist styles (pick 3 closest by sound, not by genre label alone):\n` +
    `${catalogNames.join(", ")}\n\n` +
    `Respond JSON:\n` +
    `{"era":string, "genre":string, "subgenre":string, "mood":string[], ` +
    `"bpm_estimate":number|null, "key_estimate":string, ` +
    `"instruments":string[], "vocals":string, "production":string, ` +
    `"closest":[{"name":string,"reason":string},{"name":string,"reason":string},{"name":string,"reason":string}], ` +
    `"suno_prompt":string, "producer_note":string}`;

  const json = await llmJSON(DNA_SYSTEM, user, 1200);
  if (!json?.suno_prompt) return { ok: false, error: "AI returned no analysis" };
  return { ok: true, ...json };
}

// Whisper transcription reused from Voice Memo — accepts a buffer + mime.
export async function transcribeAudio(audioBuffer, mimeType) {
  if (!process.env.OPENAI_API_KEY) return { ok: false, transcript: "" };
  const ext = mimeType.includes("ogg") ? "ogg"
    : mimeType.includes("mp4") || mimeType.includes("m4a") ? "mp4"
    : mimeType.includes("wav") ? "wav"
    : "mp3";
  const fd = new FormData();
  fd.append("file", new Blob([audioBuffer], { type: mimeType }), `track.${ext}`);
  fd.append("model", "whisper-1");
  fd.append("response_format", "json");
  try {
    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: fd
    });
    if (!res.ok) return { ok: false, transcript: "" };
    const { text } = await res.json();
    return { ok: true, transcript: text || "" };
  } catch { return { ok: false, transcript: "" }; }
}

// ─── #5 Anti-Slop Filter ─────────────────────────────────────────────────
// Rewrites cliché/weak Suno tokens into concrete, anti-generic alternatives.
// The 0-100 score is computed client-side; this only does the AI rewrite.

const ANTISLOP_SYSTEM =
  "You are an anti-cliché music-prompt editor for Suno AI v5.5. " +
  "Suno overproduces generic 'AI slop': epic cinematic orchestras, sad piano, " +
  "default melodic trap. Your job: replace vague/cliché tokens with concrete, " +
  "surprising-but-coherent production tokens (named instruments, specific drum " +
  "textures, BPM, key). Keep the user's core intent and genre. " +
  "Never name real artists. Reply JSON only.";

export async function antiSlopRewrite(prompt, flagged = []) {
  if (!aiEnabled()) return { ok: false, error: "AI provider not configured" };
  const flaggedNote = flagged.length
    ? `These tokens were flagged as weak/cliché: ${flagged.join(", ")}.\n`
    : "";
  const user =
    `Original Suno prompt:\n"${prompt}"\n\n${flaggedNote}` +
    `Rewrite it to remove clichés and vague words while keeping the same genre ` +
    `and intent. Make every token concrete. Add BPM and key if missing.\n\n` +
    `Respond JSON: {"rewritten": string, "changes": [{"from": string, "to": string, "why": string}]}.`;
  const json = await llmJSON(ANTISLOP_SYSTEM, user, 800);
  if (!json?.rewritten) return { ok: false, error: "AI returned no rewrite" };
  return {
    ok: true,
    rewritten: json.rewritten,
    changes: Array.isArray(json.changes) ? json.changes : []
  };
}

// ─── #4 Voice Memo → Prompt ──────────────────────────────────────────────
// Audio blob (webm/ogg/mp4) → Whisper transcription → Claude GMIV prompt.
// Whisper is OpenAI-only; returns null gracefully if key missing.

const VOICE_SYSTEM =
  "You are a music-direction assistant. The user has spoken a rough description of " +
  "the music they want to create in Suno AI v5.5. " +
  "Extract their intent and build a tight Suno style prompt: " +
  "genre, era, instruments, vocal character, mood, tempo (BPM), key. " +
  "Fix any vague language ('something chill', 'like the 90s') into concrete tokens. " +
  "Never name real artists. Reply JSON only.";

export async function voiceMemoToPrompt(audioBuffer, mimeType, originalName) {
  if (!process.env.OPENAI_API_KEY) {
    return { ok: false, error: "Voice Memo requires OPENAI_API_KEY for Whisper" };
  }

  // Step 1 — Whisper transcription via OpenAI multipart form
  const ext = mimeType.includes("ogg") ? "ogg"
    : mimeType.includes("mp4") || mimeType.includes("m4a") ? "mp4"
    : mimeType.includes("wav") ? "wav"
    : "webm";

  const filename = `memo.${ext}`;

  const formData = new FormData();
  const blob = new Blob([audioBuffer], { type: mimeType });
  formData.append("file", blob, filename);
  formData.append("model", "whisper-1");
  formData.append("response_format", "json");
  // hint: Suno music terminology is often in English even for Russian speakers
  formData.append("language", "ru");

  const whisperRes = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: formData
  });

  if (!whisperRes.ok) {
    const err = await whisperRes.text();
    console.error("[whisper] error:", err);
    return { ok: false, error: "Whisper transcription failed", detail: err };
  }

  const { text: transcript } = await whisperRes.json();
  if (!transcript?.trim()) {
    return { ok: false, error: "Could not hear anything. Try speaking louder." };
  }

  // Step 2 — Claude/GPT builds the GMIV prompt from transcript
  const user =
    `The user said: "${transcript}"\n\n` +
    `Build a Suno v5.5 style prompt from this request. ` +
    `If they mentioned specific artists, translate their sound into production tokens. ` +
    `Fill in missing details with reasonable defaults for the genre they described.\n\n` +
    `Respond JSON: {"prompt": string, "bpm": number|null, "key": string, ` +
    `"genre": string, "mood": string[], "instruments": string[], ` +
    `"vocals": string, "era": string}.`;

  const json = await llmJSON(VOICE_SYSTEM, user, 700);
  if (!json?.prompt) return { ok: false, error: "AI returned no prompt", transcript };

  return {
    ok: true,
    transcript,
    prompt: json.prompt,
    bpm: json.bpm || null,
    key: json.key || "",
    genre: json.genre || "",
    mood: Array.isArray(json.mood) ? json.mood : [],
    instruments: Array.isArray(json.instruments) ? json.instruments : [],
    vocals: json.vocals || "",
    era: json.era || ""
  };
}

// ─── #3 Mood from Image ──────────────────────────────────────────────────
// Image (base64) → atmosphere description → Suno prompt + mood palette.

const MOOD_SYSTEM =
  "You are a synesthete describing how a visual image would sound as music for Suno AI v5.5. " +
  "Translate dominant colors, lighting, composition and subject into musical tokens: " +
  "genre, tempo, instruments, vocal character, mood. " +
  "Never name real artists. Reply JSON only.";

export async function imageToMoodPrompt(imageBase64, mediaType) {
  if (!aiEnabled()) {
    return { ok: false, error: "Image mood needs an AI key (Anthropic or OpenAI)" };
  }
  const userText =
    `Look at this image. Describe its atmosphere in 2 sentences, then translate that ` +
    `into a Suno prompt. Pick a genre that fits the visual energy, instruments that ` +
    `match the texture, and a vocal character that matches the subject (or "instrumental").\n\n` +
    `Respond JSON: {"atmosphere": string, "prompt": string, "bpm": number, "key": string, "mood": string[], "instruments": string[], "vocal": string}.`;
  const json = await llmVisionJSON(MOOD_SYSTEM, userText, imageBase64, mediaType, 900);
  if (!json?.prompt) return { ok: false, error: "AI returned no prompt" };
  return {
    ok: true,
    atmosphere: json.atmosphere || "",
    prompt: json.prompt,
    bpm: json.bpm || null,
    key: json.key || "",
    mood: Array.isArray(json.mood) ? json.mood : [],
    instruments: Array.isArray(json.instruments) ? json.instruments : [],
    vocal: json.vocal || ""
  };
}
