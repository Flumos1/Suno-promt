// TTAPI Suno adapter — real Suno music generation.
// Docs: https://docs.ttapi.io/api/ru/suno
//
//   TTAPI_KEY  -> enables real generation. Without it, ttapiEnabled() is false
//                and callers should show "configure key" messaging.
//
// All Suno operations are async: submit returns a job_id, then poll
// GET /suno/v2/fetch?jobId=... until status SUCCESS.

const BASE = "https://api.ttapi.io";
const DEFAULT_MV = process.env.TTAPI_MV || "chirp-v5";

export function ttapiEnabled() {
  return !!process.env.TTAPI_KEY;
}

function headers() {
  return {
    "Content-Type": "application/json",
    "TT-API-KEY": process.env.TTAPI_KEY
  };
}

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.status === "FAILED") {
    throw new Error(`TTAPI ${path} ${res.status}: ${data.message || "failed"}`);
  }
  return data;
}

// ── Submit a music generation job ──────────────────────────────────────
// opts: { tags, prompt, title, instrumental, custom, mv, vocalGender,
//         negativeTags, styleWeight, descriptionPrompt }
// Returns { jobId }.
export async function submitMusic(opts = {}) {
  if (!ttapiEnabled()) throw new Error("TTAPI_KEY not configured");

  const custom = opts.custom ?? true;
  const instrumental = opts.instrumental ?? false;

  const body = {
    custom,
    instrumental,
    mv: opts.mv || DEFAULT_MV
  };

  if (custom) {
    if (opts.tags) body.tags = String(opts.tags).slice(0, 1000);
    if (opts.title) body.title = String(opts.title).slice(0, 80);
    if (!instrumental && opts.prompt) body.prompt = String(opts.prompt).slice(0, 5000);
  } else {
    // inspiration mode — single vibe text
    body.gpt_description_prompt = String(opts.descriptionPrompt || opts.tags || "").slice(0, 3000);
  }

  if (opts.negativeTags) body.negative_tags = opts.negativeTags;
  if (opts.vocalGender) body.vocal_gender = opts.vocalGender; // "Male" | "Female"
  if (typeof opts.styleWeight === "number") body.style_weight = opts.styleWeight;
  if (typeof opts.weirdness === "number") body.weirdness_constraint = opts.weirdness;
  if (opts.hookUrl) body.hookUrl = opts.hookUrl;

  const data = await post("/suno/v1/music", body);
  console.log("[ttapi] music response:", JSON.stringify(data).slice(0, 500));
  const jobId = data.data?.job_id || data.data?.jobId || data.data?.taskId
    || data.jobId || data.taskId || data.job_id || data.task_id;
  return { jobId };
}

// ── Poll a job once ────────────────────────────────────────────────────
// Returns { status, progress, musics } where musics[] has audioUrl etc.
export async function fetchJob(jobId) {
  if (!ttapiEnabled()) throw new Error("TTAPI_KEY not configured");
  const res = await fetch(`${BASE}/suno/v2/fetch?jobId=${encodeURIComponent(jobId)}`, {
    headers: { "TT-API-KEY": process.env.TTAPI_KEY }
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`TTAPI fetch ${res.status}: ${data.message || "failed"}`);
  const d = data.data || {};
  return {
    status: data.status || d.status,        // ON_QUEUE | SUCCESS | FAILED
    progress: d.progress || "0%",
    musics: Array.isArray(d.musics) ? d.musics.map(pickMusic) : []
  };
}

function pickMusic(m) {
  return {
    musicId: m.musicId,
    title: m.title,
    tags: m.tags,
    audioUrl: m.audioUrl,
    videoUrl: m.videoUrl,
    imageUrl: m.imageUrl || m.imageLargeUrl,
    duration: m.duration,
    createdAt: m.createdAt
  };
}

// ── Generate lyrics (theme → structured lyrics) ────────────────────────
export async function submitLyrics(prompt, model = "classic") {
  if (!ttapiEnabled()) throw new Error("TTAPI_KEY not configured");
  const data = await post("/suno/v1/lyrics", { prompt, lyrics_model: model });
  return { jobId: data.data?.job_id || data.jobId };
}

// ── Upload reference audio by public URL → music_id ────────────────────
export async function uploadReference(audioUrl) {
  if (!ttapiEnabled()) throw new Error("TTAPI_KEY not configured");
  const data = await post("/suno/v1/upload", { audio_url: audioUrl, is_async: false });
  return { musicId: data.data?.music_id || data.data?.musicId };
}

// ── BPM analysis of a music_id (free) ──────────────────────────────────
export async function analyzeBpm(musicId) {
  if (!ttapiEnabled()) throw new Error("TTAPI_KEY not configured");
  const data = await post("/suno/v1/gen-bpm", { music_id: musicId });
  return data.data || {}; // { avg_bpm, max_bpm, min_bpm }
}

// ── Convenience: submit + poll until done (with timeout) ───────────────
// onProgress(progressString) optional. Returns musics[] or throws.
export async function generateAndWait(opts, { timeoutMs = 180000, intervalMs = 4000, onProgress } = {}) {
  const { jobId } = await submitMusic(opts);
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, intervalMs));
    const job = await fetchJob(jobId);
    if (onProgress) onProgress(job.progress, job.status);
    if (job.status === "SUCCESS") return job.musics;
    if (job.status === "FAILED") throw new Error("Generation failed");
  }
  throw new Error("Generation timed out");
}
