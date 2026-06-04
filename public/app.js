const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const api = async (url, opts) => (await fetch(url, opts)).json();

/* ---------- Access gate ---------- */
const GATE_KEY = "siliconsense_token";

function showApp() {
  $("#gate").classList.add("hidden");
  $("#app").classList.remove("hidden");
  loadStatus();
  loadCatalog();
}

if (localStorage.getItem(GATE_KEY)) showApp();

$("#gate-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const code = $("#access-code").value;
  const data = await api("/api/access", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code })
  });
  if (data.ok) { localStorage.setItem(GATE_KEY, data.token); showApp(); }
  else $("#gate-error").textContent = data.error || "Invalid code";
});

$("#logout").addEventListener("click", () => {
  localStorage.removeItem(GATE_KEY);
  $("#app").classList.add("hidden");
  $("#gate").classList.remove("hidden");
});

/* ---------- Status ---------- */
async function loadStatus() {
  try {
    const s = await api("/api/status");
    const pill = $("#ai-pill");
    if (s.ai) {
      pill.textContent = `● AI: ${s.provider}`;
      pill.classList.add("live");
      $("#foot-engine").textContent = `${s.provider} AI engine`;
    } else {
      pill.textContent = "○ template engine";
      $("#foot-engine").textContent = "template engine";
    }
    $("#foot-count").textContent = s.catalogSize;
  } catch { /* status is non-critical */ }
}

/* ---------- Tabs ---------- */
$$(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    $$(".tab").forEach((t) => t.classList.remove("active"));
    $$(".panel").forEach((p) => p.classList.remove("active"));
    tab.classList.add("active");
    $("#tab-" + tab.dataset.tab).classList.add("active");
  });
});

/* ---------- Helpers ---------- */
function cardHTML(card, source) {
  const badge = card.ai
    ? '<span class="badge ai">AI</span>'
    : (source === "generated" || card.generated ? '<span class="badge">generated</span>' : "");
  const metaLine = [card.genre, card.key, card.bpm ? card.bpm + " BPM" : null]
    .filter(Boolean).join(" · ");
  return `
    <div class="card">
      <h3>${escapeHtml(card.name)} ${badge}</h3>
      <div class="meta">${escapeHtml(metaLine)}</div>
      <div class="prompt">${escapeHtml(card.prompt)}</div>
      <div class="tags">${(card.tags || []).map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join("")}</div>
      <button class="copy" data-prompt="${escapeAttr(card.prompt)}" style="margin-top:14px">Copy prompt</button>
    </div>`;
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function escapeAttr(s) { return escapeHtml(s).replace(/"/g, "&quot;"); }

function wireCopyButtons(root) {
  root.querySelectorAll(".copy").forEach((btn) => {
    btn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(btn.dataset.prompt);
        const old = btn.textContent; btn.textContent = "Copied ✓";
        setTimeout(() => (btn.textContent = old), 1400);
      } catch { /* clipboard may be unavailable */ }
    });
  });
}

const spin = (label) => `<span class="spinner"></span> <span class="muted">${label}</span>`;

/* ---------- Catalog ---------- */
async function loadCatalog(q = "") {
  const results = $("#results");
  const data = await api("/api/catalog?q=" + encodeURIComponent(q));
  if (!data.results.length && q) {
    results.innerHTML = `<div class="card">${spin("generating card…")}</div>`;
    const gen = await api("/api/card/" + encodeURIComponent(q));
    results.innerHTML = cardHTML(gen.card, gen.source);
  } else {
    results.innerHTML = data.results.map((c) => cardHTML(c, "catalog")).join("");
  }
  wireCopyButtons(results);
}

$("#search-btn").addEventListener("click", () => loadCatalog($("#search").value.trim()));
$("#search").addEventListener("keydown", (e) => { if (e.key === "Enter") loadCatalog($("#search").value.trim()); });

/* ---------- Vocal Anchor ---------- */
$("#anchor-btn").addEventListener("click", async () => {
  const body = {
    pitch: $("#ax-pitch").value, timbre: $("#ax-timbre").value,
    delivery: $("#ax-delivery").value, texture: $("#ax-texture").value,
    age: $("#ax-age").value, donor: $("#ax-donor").value
  };
  const data = await api("/api/vocal-anchor", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body)
  });
  const out = $("#anchor-out");
  out.innerHTML = `
    <h4>Vocal anchor</h4>
    <div class="prompt">${escapeHtml(data.suno)}</div>
    <button class="copy" data-prompt="${escapeAttr(data.suno)}" style="margin-top:12px">Copy</button>`;
  wireCopyButtons(out);
});

/* ---------- Reference Analysis (real file upload) ---------- */
const dropzone = $("#dropzone");
const fileInput = $("#file");
let currentFile = null;

dropzone.addEventListener("click", () => fileInput.click());
["dragover", "dragenter"].forEach((ev) =>
  dropzone.addEventListener(ev, (e) => { e.preventDefault(); dropzone.classList.add("drag"); }));
["dragleave", "drop"].forEach((ev) =>
  dropzone.addEventListener(ev, (e) => { e.preventDefault(); dropzone.classList.remove("drag"); }));
dropzone.addEventListener("drop", (e) => { if (e.dataTransfer.files.length) setFile(e.dataTransfer.files[0]); });
fileInput.addEventListener("change", () => { if (fileInput.files.length) setFile(fileInput.files[0]); });

function setFile(f) {
  currentFile = f;
  $("#filename").textContent = `${f.name} · ${(f.size / 1024 / 1024).toFixed(1)} MB`;
  $("#analyze-btn").disabled = false;
}

$("#analyze-btn").addEventListener("click", async () => {
  if (!currentFile) return;
  const out = $("#analyze-out");
  out.innerHTML = spin("reading audio & building prompt…");
  const fd = new FormData();
  fd.append("file", currentFile);
  let data;
  try {
    const res = await fetch("/api/analyze", { method: "POST", body: fd });
    data = await res.json();
    if (data.error) throw new Error(data.error);
  } catch (err) {
    out.innerHTML = `<div class="prompt" style="color:var(--bad)">${escapeHtml(err.message || "Analysis failed")}</div>`;
    return;
  }
  const d = data.detected;
  const modeTag = data.mode === "ai" ? '<span class="mode-tag">AI-enhanced</span>'
    : data.mode === "metadata" ? '<span class="mode-tag">from real metadata</span>' : "";
  const cells = [
    ["Genre", d.genre], ["Era", d.era], ["BPM", d.bpm || "—"],
    ["Duration", d.durationSec != null ? fmtDur(d.durationSec) : "—"],
    ["Bitrate", d.bitrate ? Math.round(d.bitrate / 1000) + " kbps" : "—"],
    ["Sample rate", d.sampleRate ? (d.sampleRate / 1000) + " kHz" : "—"],
    ["Channels", d.channels === 1 ? "mono" : d.channels === 2 ? "stereo" : (d.channels || "—")],
    ["Codec", d.codec || "—"], ["Vocals", d.vocals || "—"]
  ];
  out.innerHTML = `
    <h4>Detected ${modeTag}</h4>
    <div class="metagrid">${cells.map(([k, v]) => `<div><b>${k}</b>${escapeHtml(String(v))}</div>`).join("")}</div>
    <h4>Suno prompt</h4>
    <div class="prompt">${escapeHtml(data.prompt)}</div>
    <button class="copy" data-prompt="${escapeAttr(data.prompt)}" style="margin:12px 0">Copy prompt</button>
    <h4>3 closest catalog artists</h4>
    <div class="closest">
      ${data.closest.map((a) => `<div class="chip">${escapeHtml(a.name)}<small>${escapeHtml(a.genre)}</small></div>`).join("")}
    </div>`;
  wireCopyButtons(out);
});

function fmtDur(sec) {
  const m = Math.floor(sec / 60); const s = String(sec % 60).padStart(2, "0");
  return `${m}:${s}`;
}

/* ---------- Cover Concept ---------- */
$("#cover-btn").addEventListener("click", async () => {
  const body = {
    title: $("#cv-title").value || "Untitled",
    artist: $("#cv-artist").value || "Unknown Artist",
    genre: $("#cv-genre").value || "electronic",
    withLogo: $("#cv-logo").checked
  };
  const data = await api("/api/cover", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body)
  });
  const out = $("#cover-out");
  out.innerHTML = `
    <h4>Palette</h4>
    <div class="swatches">${data.palette.map((c) => `<div class="swatch" style="background:${escapeAttr(c)}"></div>`).join("")}</div>
    <h4>Concept (2048×2048)</h4>
    <div class="prompt">${escapeHtml(data.concept)}</div>
    <button class="copy" data-prompt="${escapeAttr(data.concept)}" style="margin-top:12px">Copy concept</button>`;
  wireCopyButtons(out);
});
