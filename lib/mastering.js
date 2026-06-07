// Local audio mastering using ffmpeg loudness normalization.
// No external service, no watermarks, no quotas.
// Implements EBU R128 / LUFS loudness targeting via ffmpeg loudnorm filter.

import { createRequire } from "node:module";
import { writeFile, readFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

const require = createRequire(import.meta.url);

let _ffmpeg = null;
let _ffmpegPath = "ffmpeg";

async function getFfmpeg() {
  if (_ffmpeg) return _ffmpeg;
  const mod = await import("fluent-ffmpeg");
  _ffmpeg = mod.default || mod;
  try {
    const staticPath = require("ffmpeg-static");
    if (staticPath) _ffmpegPath = staticPath;
  } catch { /* use system ffmpeg */ }
  _ffmpeg.setFfmpegPath(_ffmpegPath);
  return _ffmpeg;
}

const LUFS = { streaming: -14, broadcast: -23, club: -9 };

// Transcode any audio format (WebM, OGG, M4A…) to MP3.
// Used to normalise mic recordings before sending to Suno, which only accepts MP3/WAV.
export async function transcodeToMp3(inputBuf, inputExt = "webm") {
  const id = randomUUID();
  const tmpIn  = join(tmpdir(), `ss-tc-${id}.${inputExt}`);
  const tmpOut = join(tmpdir(), `ss-tc-${id}.mp3`);
  await writeFile(tmpIn, inputBuf);
  try {
    const ff = await getFfmpeg();
    await new Promise((resolve, reject) => {
      ff(tmpIn)
        .audioBitrate("192k")
        .audioFrequency(44100)
        .format("mp3")
        .output(tmpOut)
        .on("end", resolve)
        .on("error", reject)
        .run();
    });
    return await readFile(tmpOut);
  } finally {
    await Promise.all([unlink(tmpIn), unlink(tmpOut)]).catch(() => {});
  }
}

export async function masterTrack(audioUrl, { loudness = "streaming" } = {}) {
  const targetLufs = LUFS[loudness] ?? -14;

  const dlRes = await fetch(audioUrl);
  if (!dlRes.ok) throw new Error(`Cannot download audio (${dlRes.status})`);
  const inputBuf = Buffer.from(await dlRes.arrayBuffer());

  const id = randomUUID();
  const tmpIn  = join(tmpdir(), `ss-in-${id}.mp3`);
  const tmpOut = join(tmpdir(), `ss-out-${id}.mp3`);

  await writeFile(tmpIn, inputBuf);

  try {
    const ff = await getFfmpeg();
    await new Promise((resolve, reject) => {
      ff(tmpIn)
        .audioFilters(`loudnorm=I=${targetLufs}:TP=-1:LRA=11:print_format=none`)
        .audioBitrate("256k")
        .audioFrequency(44100)
        .format("mp3")
        .output(tmpOut)
        .on("end", resolve)
        .on("error", reject)
        .run();
    });
    return await readFile(tmpOut);
  } finally {
    await Promise.all([unlink(tmpIn), unlink(tmpOut)]).catch(() => {});
  }
}
