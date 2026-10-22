import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const ffmpeg = require("ffmpeg-static") || "ffmpeg";
const python = process.env.AUDIO_PYTHON || (process.platform === "win32" ? "python" : "python3");
const jobs = new Map();
const instruments = new Set(["flute", "synth", "organ"]);
let busy = false;

setInterval(async () => {
  const expired = Date.now() - 30 * 60_000;
  for (const [id, job] of jobs) {
    if (job.created < expired && job.status !== "running") {
      jobs.delete(id);
      await rm(job.dir, { recursive: true, force: true }).catch(() => {});
    }
  }
}, 60_000).unref();

export function getVocalInstrumentJob(id) {
  const job = jobs.get(id);
  if (!job) return null;
  return { status: job.status, stage: job.stage, error: job.error, instrument: job.instrument };
}

export async function getVocalInstrumentAudio(id) {
  const job = jobs.get(id);
  if (!job || job.status !== "complete") return null;
  return readFile(join(job.dir, "result.mp3"));
}

function integerSetting(value, fallback, min, max, label) {
  const parsed = value === undefined || value === "" ? fallback : Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max)
    throw new Error(`${label}: допустимо от ${min} до ${max}`);
  return parsed;
}

export async function startVocalInstrument(buffer, filename, settings = {}) {
  const instrument = settings.instrument || "flute";
  if (busy) throw new Error("Сейчас обрабатывается другой трек. Дождитесь его завершения.");
  if (!instruments.has(instrument)) throw new Error("Выберите доступный инструмент");
  const leadPitch = integerSetting(settings.leadPitch, 0, -12, 12, "Pitch");
  const tempoPercent = integerSetting(settings.tempoPercent, 100, 75, 125, "Темп");
  const keyShift = integerSetting(settings.keyShift, 0, -6, 6, "Тональность");
  const extension = extname(filename).toLowerCase();
  if (![".mp3", ".wav", ".ogg", ".m4a", ".flac"].includes(extension))
    throw new Error("Поддерживаются MP3, WAV, OGG, M4A и FLAC");
  busy = true;
  let dir;
  try {
    dir = await mkdtemp(join(tmpdir(), "ss-melody-"));
    await writeFile(join(dir, `input${extension}`), buffer);
  } catch (error) {
    busy = false;
    if (dir) await rm(dir, { recursive: true, force: true });
    throw error;
  }
  const input = join(dir, `input${extension}`);
  const id = randomUUID();
  const job = { dir, created: Date.now(), status: "running", stage: "queued", instrument, error: null };
  jobs.set(id, job);
  const args = [join(root, "scripts", "vocal_to_instrument.py"), "--source", input,
    "--output", dir, "--instrument", instrument, "--lead-pitch", String(leadPitch),
    "--tempo-percent", String(tempoPercent), "--key-shift", String(keyShift), "--ffmpeg", ffmpeg];
  const child = spawn(python, args, { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
  let stdout = "";
  let stderr = "";
  const timeout = setTimeout(() => child.kill(), 25 * 60_000);
  child.stdout.on("data", (chunk) => {
    stdout += chunk.toString();
    const lines = stdout.split(/\r?\n/);
    stdout = lines.pop() || "";
    for (const line of lines) {
      try {
        const data = JSON.parse(line);
        if (data.stage) job.stage = data.stage;
        if (data.error) job.error = data.error;
      } catch { /* non-JSON output is ignored */ }
    }
  });
  child.stderr.on("data", (chunk) => { stderr = (stderr + chunk.toString()).slice(-1200); });
  child.on("error", (error) => { job.error = error.message; });
  child.on("close", (code) => {
    clearTimeout(timeout);
    busy = false;
    job.status = code === 0 ? "complete" : "failed";
    if (code !== 0 && !job.error) job.error = stderr || "Обработка не удалась. Проверьте установку аудиомодулей.";
    if (code === 0) job.stage = "complete";
  });
  return id;
}
