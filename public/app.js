const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const api = async (url, opts) => {
  const res = await fetch(url, opts);
  return res.json();
};

/* ---------- Access gate ---------- */
const GATE_KEY = "siliconsense_token";

function showApp() {
  $("#gate").classList.add("hidden");
  $("#app").classList.remove("hidden");
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
  if (data.ok) {
    localStorage.setItem(GATE_KEY, data.token);
    showApp();
  } else {
    $("#gate-error").textContent = data.error || "Invalid code";
  }
});

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
  const badge = source === "generated" || card.generated
    ? '<span class="badge">AI generated</span>'
    : "";
  return `
    <div class="card">
      <h3>${escapeHtml(card.name)}${badge}</h3>
      <div class="meta">${escapeHtml(card.genre)} · ${escapeHtml(card.key || "")} · ${card.bpm || "?"} BPM</div>
      <div class="prompt">${escapeHtml(card.prompt)}</div>
      <div class="tags">${(card.tags || []).map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join("")}</div>
      <button class="copy" data-prompt="${escapeAttr(card.prompt)}" style="margin-top:12px">Copy prompt</button>
    </div>`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function escapeAttr(s) { return escapeHtml(s).replace(/"/g, "&quot;"); }

function wireCopyButtons(root) {
  root.querySelectorAll(".copy").forEach((btn) => {
    btn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(btn.dataset.prompt);
        const old = btn.textContent;
        btn.textContent = "Copied ✓";
        setTimeout(() => (btn.textContent = old), 1400);
      } catch { /* clipboard may be unavailable */ }
    });
  });
}

/* ---------- Catalog ---------- */
async function loadCatalog(q = "") {
  const data = await api("/api/catalog?q=" + encodeURIComponent(q));
  const results = $("#results");
  if (!data.results.length && q) {
    // Nothing in catalog: generate a card for the query.
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
    pitch: $("#ax-pitch").value,
    timbre: $("#ax-timbre").value,
    delivery: $("#ax-delivery").value,
    texture: $("#ax-texture").value,
    age: $("#ax-age").value,
    donor: $("#ax-donor").value
  };
  const data = await api("/api/vocal-anchor", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const out = $("#anchor-out");
  out.innerHTML = `
    <h4>Vocal anchor</h4>
    <div class="prompt">${escapeHtml(data.suno)}</div>
    <button class="copy" data-prompt="${escapeAttr(data.suno)}" style="margin-top:12px">Copy</button>`;
  wireCopyButtons(out);
});

/* ---------- Reference Analysis ---------- */
const dropzone = $("#dropzone");
const fileInput = $("#file");
let currentFile = null;

dropzone.addEventListener("click", () => fileInput.click());
["dragover", "dragenter"].forEach((ev) =>
  dropzone.addEventListener(ev, (e) => { e.preventDefault(); dropzone.classList.add("drag"); }));
["dragleave", "drop"].forEach((ev) =>
  dropzone.addEventListener(ev, (e) => { e.preventDefault(); dropzone.classList.remove("drag"); }));

dropzone.addEventListener("drop", (e) => {
  if (e.dataTransfer.files.length) setFile(e.dataTransfer.files[0]);
});
fileInput.addEventListener("change", () => { if (fileInput.files.length) setFile(fileInput.files[0]); });

function setFile(f) {
  currentFile = f;
  $("#filename").textContent = f.name;
  $("#analyze-btn").disabled = false;
}

$("#analyze-btn").addEventListener("click", async () => {
  if (!currentFile) return;
  const data = await api("/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filename: currentFile.name })
  });
  const d = data.detected;
  const out = $("#analyze-out");
  out.innerHTML = `
    <h4>Detected</h4>
    <div class="prompt">
      <b>Genre:</b> ${escapeHtml(d.genre)} · <b>Era:</b> ${escapeHtml(d.era)} · <b>${d.bpm} BPM</b> · ${escapeHtml(d.key)}<br/>
      <b>Vocals:</b> ${escapeHtml(d.vocals)}<br/>
      <b>Instruments:</b> ${d.instruments.map(escapeHtml).join(", ")}
    </div>
    <h4>Suno prompt</h4>
    <div class="prompt">${escapeHtml(data.prompt)}</div>
    <button class="copy" data-prompt="${escapeAttr(data.prompt)}" style="margin:12px 0">Copy prompt</button>
    <h4>3 closest catalog artists</h4>
    <div class="closest">
      ${data.closest.map((a) => `<div class="chip">${escapeHtml(a.name)}<small>${escapeHtml(a.genre)}</small></div>`).join("")}
    </div>`;
  wireCopyButtons(out);
});

/* ---------- Cover Concept ---------- */
$("#cover-btn").addEventListener("click", async () => {
  const body = {
    title: $("#cv-title").value || "Untitled",
    artist: $("#cv-artist").value || "Unknown Artist",
    genre: $("#cv-genre").value || "electronic",
    withLogo: $("#cv-logo").checked
  };
  const data = await api("/api/cover", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
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
