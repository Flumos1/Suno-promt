// Dolby.io Media Enhance API — music mastering/cleanup.
// Free tier: 200 min/month (~66 tracks @ 3 min). Then $0.05/min.
// Auth: single x-api-key header (get from dashboard.dolby.io → Media APIs).

const BASE = "https://api.dolby.com";

export function dolbyEnabled() {
  return !!process.env.DOLBY_API_KEY;
}

function hdr() {
  return {
    "x-api-key": process.env.DOLBY_API_KEY,
    "Content-Type": "application/json",
    "Accept": "application/json"
  };
}

// Submit mastering job. Returns { jobId, outputPath }.
export async function submitMasterJob(audioUrl, { loudness = "streaming" } = {}) {
  const outputPath = `dlb://out/ss-${Date.now()}.mp3`;
  const targetLevel = loudness === "club" ? -9 : loudness === "broadcast" ? -23 : -14;

  const res = await fetch(`${BASE}/media/enhance`, {
    method: "POST",
    headers: hdr(),
    body: JSON.stringify({
      input: audioUrl,
      output: outputPath,
      content: { type: "music" },
      audio: {
        noise: { reduction: { amount: "low" } },
        loudness: { enable: true, target_level: targetLevel }
      }
    })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Dolby submit ${res.status}: ${text}`);
  }
  const data = await res.json();
  if (!data.job_id) throw new Error("Dolby returned no job_id");
  return { jobId: data.job_id, outputPath };
}

// Poll status. Returns { status, progress, downloadUrl? }.
// status: "Pending" | "Running" | "Success" | error string.
export async function getMasterStatus(jobId, outputPath) {
  const res = await fetch(
    `${BASE}/media/enhance?job_id=${encodeURIComponent(jobId)}`,
    { headers: { "x-api-key": process.env.DOLBY_API_KEY, "Accept": "application/json" } }
  );
  if (!res.ok) throw new Error(`Dolby status ${res.status}`);
  const data = await res.json();

  // API may return { job_id, status, progress } directly or { jobs: [...] }
  const job = Array.isArray(data.jobs) ? data.jobs[0] : data;
  const status = job.status || "Running";
  const progress = job.progress ?? 0;

  if (status === "Success" && outputPath) {
    const downloadUrl = await requestOutputUrl(outputPath);
    return { status, progress, downloadUrl };
  }
  if (status !== "Pending" && status !== "Running" && status !== "Success") {
    throw new Error(`Dolby job ${status}`);
  }
  return { status, progress };
}

// Request a presigned download URL for a dlb:// path (valid ~24h).
async function requestOutputUrl(dlbPath) {
  const res = await fetch(`${BASE}/media/output`, {
    method: "POST",
    headers: hdr(),
    body: JSON.stringify({ url: dlbPath })
  });
  if (!res.ok) throw new Error(`Dolby output URL ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.url;
}
