// Auphonic API — music mastering / loudness normalization.
// Free tier: 2 hours/month (~40 tracks @ 3 min).
// Auth: Bearer token (long random string) or Basic Auth.
// Correct field name: input_file (NOT file).
// Docs: https://auphonic.com/api

import { Readable } from "node:stream";

const BASE = "https://auphonic.com/api";

export function auphonicEnabled() {
  return !!(process.env.AUPHONIC_USER && process.env.AUPHONIC_PASS);
}

function authHeader() {
  const pass = process.env.AUPHONIC_PASS || "";
  if (pass.length >= 20 && !/\s/.test(pass)) {
    return { Authorization: `Bearer ${pass}` };
  }
  const b64 = Buffer.from(`${process.env.AUPHONIC_USER}:${pass}`).toString("base64");
  return { Authorization: `Basic ${b64}` };
}

// Builds a multipart/form-data body as a Buffer.
// Node.js native FormData+Blob doesn't always serialize binary files correctly,
// so we construct the body manually.
function buildMultipart(fields, files) {
  const boundary = `----AuphonicBoundary${Date.now()}`;
  const parts = [];

  for (const [name, value] of Object.entries(fields)) {
    parts.push(
      Buffer.from(
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="${name}"\r\n\r\n` +
        `${value}\r\n`
      )
    );
  }

  for (const { name, buf, filename, type } of files) {
    parts.push(
      Buffer.from(
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="${name}"; filename="${filename}"\r\n` +
        `Content-Type: ${type}\r\n\r\n`
      ),
      Buffer.isBuffer(buf) ? buf : Buffer.from(buf),
      Buffer.from("\r\n")
    );
  }

  parts.push(Buffer.from(`--${boundary}--\r\n`));
  return { body: Buffer.concat(parts), contentType: `multipart/form-data; boundary=${boundary}` };
}

// Download audio from URL, upload to Auphonic Simple API.
// Returns { jobId: uuid }.
export async function submitMasterJob(audioUrl, { loudness = "streaming" } = {}) {
  const targetLevel = loudness === "club" ? -9 : loudness === "broadcast" ? -23 : -14;

  const dlRes = await fetch(audioUrl);
  if (!dlRes.ok) throw new Error(`Cannot download audio (${dlRes.status})`);
  const rawBuf = await dlRes.arrayBuffer();
  const audioBuf = Buffer.from(rawBuf);

  const { body, contentType } = buildMultipart(
    {
      action: "start",
      "output_format[format]": "mp3",
      "output_format[bitrate]": "256",
      "algorithms[loudnesstarget]": String(targetLevel),
      "algorithms[normloudness]": "True"
    },
    [{ name: "input_file", buf: audioBuf, filename: "track.mp3", type: "audio/mpeg" }]
  );

  const res = await fetch(`${BASE}/simple/productions.json`, {
    method: "POST",
    headers: { ...authHeader(), "Content-Type": contentType },
    body
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Auphonic submit ${res.status}: ${text}`);
  }
  const data = await res.json();
  if (data.status_code !== 200 || !data.data?.uuid) {
    throw new Error(data.error_message || "Auphonic returned no UUID");
  }
  return { jobId: data.data.uuid };
}

// Fetch the mastered file from Auphonic with auth, return as Buffer.
// Used server-side to proxy the download so the browser never needs Auphonic credentials.
export async function downloadMasterFile(downloadUrl) {
  const res = await fetch(downloadUrl, { headers: authHeader() });
  if (!res.ok) throw new Error(`Auphonic download ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

// Poll status. Returns { status, progress, downloadUrl? }.
export async function getMasterStatus(jobId) {
  const res = await fetch(`${BASE}/production/${encodeURIComponent(jobId)}.json`, {
    headers: { ...authHeader(), Accept: "application/json" }
  });
  if (!res.ok) throw new Error(`Auphonic status ${res.status}`);
  const data = await res.json();
  const prod = data.data;

  const statusStr = prod.status_string || "";
  const progress = prod.progress_percent ?? 0;

  if (statusStr === "Done") {
    const file = prod.output_files?.find(f => f.format === "mp3") || prod.output_files?.[0];
    if (!file?.download_url) throw new Error("Auphonic: Done but no download URL");
    return { status: "Success", progress: 100, downloadUrl: file.download_url };
  }
  if (statusStr === "Error" || statusStr === "Failed") {
    throw new Error(`Auphonic production failed: ${prod.error_message || statusStr}`);
  }
  return { status: "Running", progress };
}
