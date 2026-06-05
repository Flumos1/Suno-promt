// Wave 1 AI features: text-in/text-out + vision.
// All functions return { ok: true, ... } or { ok: false, error, fallback? }.

import { llmJSON, llmVisionJSON, aiEnabled } from "./aiProvider.js";

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
