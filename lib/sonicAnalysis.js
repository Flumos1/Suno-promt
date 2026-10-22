import { spawn } from "node:child_process";
import ffmpegPath from "ffmpeg-static";

const MAX_SAMPLE_SECONDS = 60;

function encodeMontage(buffer, filter, bitrate, maxBytes) {
  if (!ffmpegPath) throw new Error("Audio decoder is unavailable");
  const args = ["-hide_banner", "-loglevel", "error", "-i", "pipe:0", "-filter_complex", filter,
    "-map", "[out]", "-ac", "2", "-ar", "32000", "-b:a", bitrate, "-f", "mp3", "pipe:1"];
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath, args, { stdio: ["pipe", "pipe", "pipe"] });
    const chunks = [];
    let bytes = 0;
    let stderr = "";
    const timer = setTimeout(() => proc.kill(), 90_000);
    proc.stdout.on("data", (chunk) => {
      bytes += chunk.length;
      if (bytes > maxBytes) proc.kill();
      else chunks.push(chunk);
    });
    proc.stderr.on("data", (chunk) => { stderr = (stderr + chunk.toString()).slice(-500); });
    proc.on("error", reject);
    proc.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0 || !bytes || bytes > maxBytes) reject(new Error(`Could not decode audio: ${stderr || "invalid file"}`));
      else resolve(Buffer.concat(chunks));
    });
    proc.stdin.on("error", () => {});
    proc.stdin.end(buffer);
  });
}

// Prepare a small, representative montage rather than sending the whole track.
// All edits are in memory; neither the source nor the sample is saved on disk.
export function makeAudioSample(buffer, durationSec) {
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
  return encodeMontage(buffer, filter, "96k", 1024 * 1024).then((audio) => ({
    audio, starts, sampleSeconds: starts.length === 1 ? Math.min(duration || 60, 60) : 60
  }));
}

// A separate overview of the form: short excerpts spread over the whole song.
// Silence between excerpts makes boundaries audible to the model. The timeline
// is necessarily approximate between sample anchors.
export function makeFormSample(buffer, durationSec) {
  const duration = Number(durationSec);
  if (!Number.isFinite(duration) || duration < 20)
    throw new Error("Form analysis requires a track of at least 20 seconds with a readable duration");
  const clipSeconds = 8;
  const gapSeconds = 0.65;
  const count = Math.min(12, Math.ceil(duration / clipSeconds));
  const starts = Array.from({ length: count }, (_, i) =>
    (duration - clipSeconds) * i / (count - 1));
  const filters = starts.map((start, i) =>
    `[0:a]atrim=start=${start.toFixed(2)}:duration=${clipSeconds},asetpts=PTS-STARTPTS,apad=pad_dur=${gapSeconds},atrim=duration=${clipSeconds + gapSeconds}[a${i}]`
  );
  const filter = `${filters.join(";")};${starts.map((_, i) => `[a${i}]`).join("")}concat=n=${count}:v=0:a=1[out]`;
  return encodeMontage(buffer, filter, "64k", 1024 * 1024).then((audio) => ({
    audio, starts, clipSeconds, gapSeconds,
    sampleSeconds: count * clipSeconds,
    coveragePercent: Math.min(100, Math.round(count * clipSeconds / duration * 100))
  }));
}

// Detect steady test tones and drones before asking a speech-oriented audio
// model to infer instruments or song sections. This deliberately says only
// whether there is measurable change, not what instrument produced it.
export async function measureFormSignal(sample, context) {
  const rate = 8000;
  const args = ["-hide_banner", "-loglevel", "error", "-i", "pipe:0", "-ac", "1",
    "-ar", String(rate), "-f", "s16le", "pipe:1"];
  const pcm = await new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath, args, { stdio: ["pipe", "pipe", "pipe"] });
    const chunks = [];
    let bytes = 0;
    let stderr = "";
    const timer = setTimeout(() => proc.kill(), 90_000);
    proc.stdout.on("data", (chunk) => {
      bytes += chunk.length;
      if (bytes > 2 * 1024 * 1024) proc.kill();
      else chunks.push(chunk);
    });
    proc.stderr.on("data", (chunk) => { stderr = (stderr + chunk.toString()).slice(-300); });
    proc.on("error", reject);
    proc.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0 || !bytes || bytes > 2 * 1024 * 1024) reject(new Error(`Could not inspect audio: ${stderr || "invalid sample"}`));
      else resolve(Buffer.concat(chunks));
    });
    proc.stdin.on("error", () => {});
    proc.stdin.end(sample);
  });
  const windows = [];
  const length = Math.floor(pcm.length / 2);
  const windowSamples = rate / 4;
  for (let excerpt = 0; excerpt < context.starts.length; excerpt++) {
    const excerptStart = (context.clipSeconds + context.gapSeconds) * excerpt;
    const values = [];
    for (let offset = 0.5; offset < context.clipSeconds - 0.5; offset += 0.25) {
      const start = Math.round((excerptStart + offset) * rate);
      if (start + windowSamples > length) break;
      let power = 0;
      let crosses = 0;
      let last = pcm.readInt16LE(start * 2);
      for (let i = 0; i < windowSamples; i++) {
        const v = pcm.readInt16LE((start + i) * 2);
        power += v * v;
        if ((v >= 0) !== (last >= 0)) crosses++;
        last = v;
      }
      const rms = Math.sqrt(power / windowSamples) / 32768;
      if (rms > 0.001) values.push({ rms, crossingHz: crosses * 2 });
    }
    const stats = (key) => {
      const mean = values.reduce((sum, v) => sum + v[key], 0) / Math.max(1, values.length);
      const variance = values.reduce((sum, v) => sum + (v[key] - mean) ** 2, 0) / Math.max(1, values.length);
      return { mean, variation: mean ? Math.sqrt(variance) / mean : 0 };
    };
    windows.push({ rms: stats("rms"), crossingHz: stats("crossingHz"), validWindows: values.length });
  }
  const stationary = windows.length >= 2 && windows.every((w) =>
    w.validWindows >= 8 && w.rms.variation < 0.055 && w.crossingHz.variation < 0.07);
  const silent = windows.every((w) => w.validWindows < 8);
  return { stationary, silent, excerpts: windows };
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

const FORM_SYSTEM = `You are a cautious music-form analyst. You hear a montage of equal eight-second excerpts from one track, in chronological order, separated by 0.65 seconds of digital silence. Excerpt 1 begins at the first timestamp given by the user. Report what is actually audible in each excerpt, especially recurring melodic/rhythmic motifs, entrances/exits of instruments, energy, fills, breaks, and contrast. Silence separators are not part of the song. Do not assume that unsampled passages contain transitions or that a motif is identical merely because the genre is similar. Describe repetitions only when you can recognize them by sound. Do not infer exact section boundaries from excerpts. Return JSON only: {"observations":[{"index":1,"heard":"short Russian description","motif":"short Russian description or empty","layers":"short Russian description","energy":0,"change":"short Russian description","confidence":"high|medium|low"}],"overall_form":"Russian summary","recurring_motifs":["Russian descriptions"],"markup_draft":"English bracket-only instrumental arrangement tags, one per line"}. Energy is an integer from 0 to 5. Do not include lyrics or real artist names in markup_draft.`;

export async function analyzeFormAudio(sample, context) {
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
          { role: "system", content: FORM_SYSTEM },
          { role: "user", content: [
            { type: "text", text: `The source track lasts ${Math.round(context.durationSec)} seconds. The ${context.starts.length} excerpts begin at these times in seconds: ${context.starts.map(Math.round).join(", ")}. Each excerpt lasts ${context.clipSeconds} seconds, followed by ${context.gapSeconds} seconds of silence. Make one indexed observation per excerpt. Analyze the form from evidence, not tags or filename. Return JSON only.` },
            { type: "input_audio", input_audio: { data: sample.toString("base64"), format: "mp3" } }
          ] }
        ]
      })
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(`Audio model error ${response.status}: ${payload.error?.message || "request failed"}`);
    const raw = payload.choices?.[0]?.message?.content;
    const json = JSON.parse(String(raw || "").replace(/^```(?:json)?\s*|\s*```$/g, "").trim());
    if (!Array.isArray(json.observations) || json.observations.length < 2)
      throw new Error("Audio model did not return enough form observations");
    return json;
  } finally {
    clearTimeout(timer);
  }
}

export async function composeInstrumentalForm(report, context) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");
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
          { role: "system", content: `You turn time-stamped listening observations into a cautious song-form map and a practical Suno instrumental arrangement. Return JSON only with keys summary (Russian), sections (array of {startSec:number,endSec:number,label:string,evidence:string,confidence:"high"|"medium"|"low"}), recurringTheme (Russian), transitions (Russian array), limitations (Russian string), instrumentalMarkup (English string). Boundaries are approximate, chosen at the provided sample anchors; never claim exact seconds of an unobserved change. Group adjacent similar excerpts; distinguish a returning motif from a merely similar sound. Do not invent a bridge, break or reprise if the observations do not support it. Suno markup is an arrangement proposal inspired by the observed form, not a transcription. When audible form is supported, write 2–9 lines, each entirely enclosed in square brackets, with standard section names Intro, Verse, Chorus, Bridge, Break, Outro as appropriate and a brief instrument/energy direction after a colon. Repeat the same motif description when Chorus returns. If the observations do not support a meaningful form, return sections [] and instrumentalMarkup "", explaining why in limitations. No sung words, artist names, lyric lines, exact bar counts or unsupported instruments. If the source contains vocals, represent their melodic role instrumentally using an observed instrument or a generic lead tone. Never copy lyrics.` },
          { role: "user", content: JSON.stringify({
            durationSec: context.durationSec, excerptStarts: context.starts.map(Math.round),
            excerptSeconds: context.clipSeconds, observations: report.observations,
            overallForm: report.overall_form, recurringMotifs: report.recurring_motifs,
            markupDraft: report.markup_draft
          }) }
        ]
      })
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(`Form editor error ${response.status}: ${payload.error?.message || "request failed"}`);
    const result = JSON.parse(payload.choices?.[0]?.message?.content || "{}");
    const markup = String(result.instrumentalMarkup || "").split(/\r?\n/)
      .map((line) => line.trim()).filter((line) => /^\[(?:Intro|Verse|Chorus|Pre-Chorus|Bridge|Break|Drop|Interlude|Build|Outro|Instrumental)(?:\s+\d+)?(?::[^\]\r\n]{1,160})?\]$/i.test(line))
      .slice(0, 9).join("\n");
    if (result.instrumentalMarkup && markup.split("\n").filter(Boolean).length < 2)
      throw new Error("Form editor did not return usable Suno section tags");
    const duration = Number(context.durationSec);
    const anchors = [...context.starts.map(Math.round), duration];
    const snap = (value) => anchors.reduce((best, anchor) =>
      Math.abs(anchor - value) < Math.abs(best - value) ? anchor : best, anchors[0]);
    const sections = (Array.isArray(result.sections) ? result.sections : []).slice(0, 12)
      .map((s) => ({
        startSec: snap(Math.min(duration, Math.max(0, Number(s.startSec) || 0))),
        endSec: snap(Math.min(duration, Math.max(0, Number(s.endSec) || duration))),
        label: String(s.label || "Section").slice(0, 80),
        evidence: String(s.evidence || "").slice(0, 400),
        confidence: ["high", "medium", "low"].includes(s.confidence) ? s.confidence : "low"
      })).filter((s) => s.endSec > s.startSec).sort((a, b) => a.startSec - b.startSec);
    return {
      summary: String(result.summary || report.overall_form || ""),
      sections,
      recurringTheme: String(result.recurringTheme || ""),
      transitions: Array.isArray(result.transitions) ? result.transitions.map(String).slice(0, 8) : [],
      limitations: String(result.limitations || "Границы частей приблизительны: между прослушанными фрагментами возможны пропущенные переходы."),
      markup
    };
  } finally {
    clearTimeout(timer);
  }
}
