// Song-structure and lyrics tools.
// Template-driven by default; uses the LLM when a provider key is configured.
import { llmComplete, aiEnabled } from "./aiProvider.js";

const SECTION_PRESETS = {
  standard: ["Intro", "Verse 1", "Pre-Chorus", "Chorus", "Verse 2", "Pre-Chorus", "Chorus", "Bridge", "Chorus", "Outro"],
  short: ["Intro", "Verse", "Chorus", "Verse", "Chorus", "Outro"],
  electronic: ["Intro", "Build", "Drop", "Breakdown", "Build", "Drop", "Outro"],
  ballad: ["Intro", "Verse 1", "Chorus", "Verse 2", "Chorus", "Bridge", "Final Chorus", "Outro"]
};

const SECTION_HINTS = {
  Intro: "atmospheric, establish key instruments, no vocals",
  Build: "rising tension, filtered drums, riser fx",
  Drop: "full energy, main hook, heaviest instrumentation",
  Breakdown: "stripped back, emotional, sparse",
  "Pre-Chorus": "lift, tighten rhythm, build anticipation",
  Chorus: "biggest hook, full harmony, memorable",
  "Final Chorus": "key change or extra layer, peak energy",
  Bridge: "contrast, new chord movement, dynamic shift",
  Outro: "wind down, fade or resolve"
};

// Build a Suno-ready structured prompt with [Section] tags.
export function buildSongStructure({ style = "", preset = "standard", title = "" }) {
  const sections = SECTION_PRESETS[preset] || SECTION_PRESETS.standard;
  const head = style ? `[Style] ${style}\n` : "";
  const titleLine = title ? `[Title] ${title}\n` : "";
  const body = sections
    .map((s) => {
      const base = s.replace(/\s\d+$/, "");
      const hint = SECTION_HINTS[base];
      return `[${s}]${hint ? `  // ${hint}` : ""}`;
    })
    .join("\n");
  return { preset, sections, suno: `${titleLine}${head}${body}` };
}

export async function aiSongStructure({ style, preset, title }) {
  if (!aiEnabled()) return null;
  const sys =
    "You are a Suno AI song architect. Given a style, output a structured arrangement " +
    "using [Section] tags (Intro/Verse/Chorus/Bridge/Outro etc.) with a short production " +
    "note after each as a // comment. Keep it concise and ready to paste into Suno.";
  const user = `Style: ${style || "open"}\nPreset feel: ${preset || "standard"}\nTitle: ${title || "(none)"}\nReturn only the structured arrangement text.`;
  const text = await llmComplete(sys, user, 600);
  return text ? text.trim() : null;
}

// Template lyric skeleton (used when AI is off).
export function buildLyricSkeleton({ theme = "the open road", mood = "hopeful", language = "English" }) {
  const v = (n) => `[Verse ${n}]\n(${language}, ${mood}) lines about ${theme}, concrete imagery, set the scene\n…\n`;
  const chorus = `[Chorus]\nbig singable hook about ${theme}, repeat the central feeling of being ${mood}\n…\n`;
  return `${v(1)}\n${chorus}\n${v(2)}\n${chorus}\n[Bridge]\na turn — contrast or revelation about ${theme}\n…\n\n${chorus}`;
}

export async function aiLyrics({ theme, mood, language, style }) {
  if (!aiEnabled()) return null;
  const sys =
    "You are a professional songwriter. Write original lyrics with [Verse]/[Chorus]/[Bridge] " +
    "section tags ready for Suno. Keep them evocative and singable. Do not imitate any real artist.";
  const user = `Theme: ${theme}\nMood: ${mood}\nLanguage: ${language}\nMusical style: ${style || "open"}\nWrite a full set of lyrics.`;
  const text = await llmComplete(sys, user, 900);
  return text ? text.trim() : null;
}
