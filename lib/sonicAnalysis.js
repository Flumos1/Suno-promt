import { spawn } from "node:child_process";
import ffmpegPath from "ffmpeg-static";

const MAX_SAMPLE_SECONDS = 60;

// Prepare a small, representative montage rather than sending the whole track.
// All edits are in memory; neither the source nor the sample is saved on disk.
export function makeAudioSample(buffer, durationSec) {
  if (!ffmpegPath) throw new Error("Audio decoder is unavailable");
  const duration = Number(durationSec) || 0;
  const starts = duration > 75
    ? [0, Math.max(0, duration / 2 - 10), Math.max(0, duration - 20)]
    : [0];
  const filters = starts.map((start, i) =>
    `[0:a]atrim=start=${start.toFixed(2)}:duration=${starts.length === 1 ? MAX_SAMPLE_SECONDS : 20},asetpts=PTS-STARTPTS[a${i}]`
  );
  const filter = starts.length === 1
    ? filters[0].replace("[a0]", "[out]")
    : `${filters.join(";")};${starts.map((_, i) => `[a${i}]`).join("")}concat=n=${starts.length}:v=0:a=1[out]`;
  const args = ["-hide_banner", "-loglevel", "error", "-i", "pipe:0", "-filter_complex", filter,
    "-map", "[out]", "-ac", "2", "-ar", "32000", "-b:a", "96k", "-f", "mp3", "pipe:1"];
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath, args, { stdio: ["pipe", "pipe", "pipe"] });
    const chunks = [];
    let bytes = 0;
    let stderr = "";
    const timer = setTimeout(() => proc.kill(), 90_000);
    proc.stdout.on("data", (chunk) => {
      bytes += chunk.length;
      if (bytes > 1024 * 1024) proc.kill();
      else chunks.push(chunk);
    });
    proc.stderr.on("data", (chunk) => { stderr = (stderr + chunk.toString()).slice(-500); });
    proc.on("error", reject);
    proc.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0 || !bytes || bytes > 1024 * 1024) reject(new Error(`Could not decode audio: ${stderr || "invalid file"}`));
      else resolve({ audio: Buffer.concat(chunks), starts, sampleSeconds: starts.length === 1 ? Math.min(duration || 60, 60) : 60 });
    });
    proc.stdin.on("error", () => {});
    proc.stdin.end(buffer);
  });
}

const ANALYSIS_SYSTEM = `You are an expert music producer and critical listener. Listen to the supplied recording itself. Ignore filename, ID3 tags, album art, and any claims about it. Return a JSON object only. First identify 3–6 concrete audible events/timbres in audible_evidence. Derive every musical claim and every Suno prompt detail from those observations. Do not complete a stereotyped genre arrangement from a few sounds. If the recording is a stationary tone, silence, noise, or too short for musical inference, explicitly say so; report no drums, vocals or bass unless you actually hear them. If a source/instrument cannot be identified confidently, describe its timbre instead. Treat BPM and key as tentative, use null if not clearly inferable. Never claim exact BPM or key from hearing alone. Never name any artist, imitate a named artist, reproduce lyrics, or imply ownership. Write one useful English Suno style prompt, 60–110 words if enough music is audible, with genre/subgenre, groove and approximate pace, audible sources and their roles, vocal character/language if audible, melodic and harmonic mood, arrangement/energy arc only if supported by sampled excerpts, and mix/production texture. Prefer concrete sounds and relationships over generic adjectives. Prompt must be directly pasteable into Suno's Style field. JSON keys: audible_evidence (array of short Russian observations), summary (string, in Russian), genre (string), subgenre (string), mood (array of short Russian strings), instruments (array of precise Russian phrases), vocals (string in Russian), rhythm (string in Russian), harmony (string in Russian), production (string in Russian), structure (string in Russian), bpm_estimate (number or null), key_estimate (string or null), confidence_notes (array of Russian strings), suno_prompt (string in English).`;

export async function analyzeSound(sample, context = {}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 180_000);
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model: process.env.SONIC_AUDIO_MODEL || "gpt-audio-1.5",
        modalities: ["text"],
        messages: [
          { role: "system", content: ANALYSIS_SYSTEM },
          { role: "user", content: [
            { type: "text", text: `Analyze this ${context.sampleSeconds || 60}-second audio sample. Excerpts begin at ${context.starts?.map(n => `${Math.round(n)}s`).join(", ") || "0s"} of a ${Math.round(context.durationSec || 0)}-second recording. Describe only what can be heard in these excerpts; do not infer unsampled sections. Return JSON only.` },
            { type: "input_audio", input_audio: { data: sample.toString("base64"), format: "mp3" } }
          ] }
        ]
      })
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(`Audio model error ${response.status}: ${payload.error?.message || "request failed"}`);
    const raw = payload.choices?.[0]?.message?.content;
    const json = JSON.parse(String(raw || "").replace(/^```(?:json)?\s*|\s*```$/g, "").trim());
    if (!json.suno_prompt || !json.summary) throw new Error("Audio model returned an incomplete report");
    return json;
  } finally {
    clearTimeout(timer);
  }
}

// A text-only editorial pass makes the Style prompt denser without giving the
// writer access to artist names, tags or the source filename.
export async function refineSunoPrompt(report) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return report.suno_prompt;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60_000);
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model: process.env.SONIC_PROMPT_MODEL || "gpt-4o",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: `You edit Suno Style prompts for a professional producer. Use only the listening report provided. Return JSON {"prompt":"..."}. Write 65–95 English words when the evidence supports it, otherwise be shorter. Produce a direct style description, never instructions to the listener or imperative verbs (no "craft", "create", "introduce", "highlight", "ensure"). Make every clause acoustically specific: source, timbre, role, groove, vocal delivery, arrangement, space and mix. Show how layers relate. Do not use these vague words or close synonyms: warm, smooth, atmospheric, immersive, cohesive, beautiful, emotional, vibe, texture, depth, enhance, interplay. Do not introduce any sound, language, BPM, key, instrument or structural event absent from the report. Never mention real artists, lyrics, the uploaded file, or uncertainty disclaimers inside the prompt. No title or markdown.` },
          { role: "user", content: JSON.stringify({
            audible_evidence: report.audible_evidence,
            genre: report.genre, subgenre: report.subgenre, mood: report.mood,
            instruments: report.instruments, vocals: report.vocals,
            rhythm: report.rhythm, harmony: report.harmony,
            structure: report.structure, production: report.production,
            bpm_estimate: report.bpm_estimate, key_estimate: report.key_estimate
          }) }
        ]
      })
    });
    if (!response.ok) return report.suno_prompt;
    const payload = await response.json();
    const edited = JSON.parse(payload.choices?.[0]?.message?.content || "{}").prompt;
    return typeof edited === "string" && edited.trim().length >= 30 ? edited.trim() : report.suno_prompt;
  } catch {
    return report.suno_prompt;
  } finally {
    clearTimeout(timer);
  }
}
