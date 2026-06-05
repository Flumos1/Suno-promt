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
