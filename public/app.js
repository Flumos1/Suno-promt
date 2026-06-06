const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);
const api = async (url, opts) => (await fetch(url, opts)).json();

const GATE_KEY = "siliconsense_token";
const UNLOCK_KEY = "siliconsense_unlock";
const SAVED_KEY = "siliconsense_saved";

const state = { language: "", era: "", genre: "", mood: "", q: "", free: false, isNew: false, page: 1 };
let facets = null;
let canGenerate = false; // set from /api/status

/* ---------- Access gate ---------- */
function showApp() {
  $("#gate").classList.add("hidden");
  $("#app").classList.remove("hidden");
  loadStatus();
  loadFacets().then(loadCatalog);
  renderUnlockPill();
  renderSaved();
}
// Auto-enter the app if already authorized — called at the very end of the
// file so all const helpers (spin, getSaved, …) are initialized first.

$("#gate-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const data = await api("/api/access", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code: $("#access-code").value })
  });
  if (data.ok) { localStorage.setItem(GATE_KEY, data.token); showApp(); }
  else $("#gate-error").textContent = data.error || "Invalid code";
});
$("#logout").addEventListener("click", () => {
  localStorage.removeItem(GATE_KEY);
  $("#app").classList.add("hidden"); $("#gate").classList.remove("hidden");
});

/* ---------- Status ---------- */
async function loadStatus() {
  try {
    const s = await api("/api/status");
    const pill = $("#ai-pill");
    if (s.ai) { pill.textContent = `● AI: ${s.provider}`; pill.classList.add("live"); $("#foot-engine").textContent = `${s.provider} AI engine`; }
    else { pill.textContent = "○ template engine"; $("#foot-engine").textContent = "template engine"; }
    $("#foot-count").textContent = s.catalogSize;
    canGenerate = !!s.generate;
  } catch { /* non-critical */ }
}

/* ---------- Tabs ---------- */
$$(".tab").forEach((tab) => tab.addEventListener("click", () => {
  $$(".tab").forEach((t) => t.classList.remove("active"));
  $$(".panel").forEach((p) => p.classList.remove("active"));
  tab.classList.add("active");
  $("#tab-" + tab.dataset.tab).classList.add("active");
  if (tab.dataset.tab === "saved") renderSaved();
}));

/* ---------- Helpers ---------- */
function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function escapeAttr(s) { return escapeHtml(s).replace(/"/g, "&quot;"); }
const spin = (label) => `<span class="spinner"></span> <span class="muted">${label}</span>`;

function wireCopyButtons(root) {
  root.querySelectorAll(".copy").forEach((btn) => btn.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(btn.dataset.prompt);
      const old = btn.textContent; btn.textContent = "Copied ✓"; setTimeout(() => (btn.textContent = old), 1400);
    } catch { /* unavailable */ }
  }));
}

/* ---------- Saved prompts ---------- */
const getSaved = () => { try { return JSON.parse(localStorage.getItem(SAVED_KEY)) || []; } catch { return []; } };
const setSaved = (arr) => localStorage.setItem(SAVED_KEY, JSON.stringify(arr));
const isSaved = (id) => getSaved().some((s) => s.id === id);
function toggleSave(item) {
  const arr = getSaved();
  const i = arr.findIndex((s) => s.id === item.id);
  if (i >= 0) arr.splice(i, 1); else arr.unshift({ ...item, ts: Date.now() });
  setSaved(arr);
}

/* ---------- Facets & filters ---------- */
async function loadFacets() {
  facets = await api("/api/facets");
  $("#cat-total").textContent = `${facets.total} styles`;
  // Language row
  const langs = [{ code: "", label: "Все" }, ...facets.languages.sort((a, b) => b.n - a.n)];
  $("#f-language").innerHTML = langs.map((l) =>
    `<button class="fchip" data-f="language" data-v="${escapeAttr(l.code)}">${escapeHtml(l.label)}${l.n ? `<span class="n">${l.n}</span>` : ""}</button>`).join("");
  // Era row
  const eras = ["", "1960s", "1970s", "1980s", "1990s", "2000s", "2010s", "2020s"];
  const eraChips = eras.map((e) =>
    `<button class="fchip" data-f="era" data-v="${e}">${e || "Все эпохи"}</button>`).join("");
  $("#f-era").innerHTML = eraChips +
    `<button class="fchip" data-f="isNew" data-v="1">Новинки<span class="n">${facets.isNew}</span></button>` +
    `<button class="fchip" data-f="free" data-v="1">★ Бесплатные<span class="n">${facets.free}</span></button>`;
  // Genre row
  const genres = Object.entries(facets.genres).sort((a, b) => b[1] - a[1]);
  $("#f-genre").innerHTML = `<button class="fchip" data-f="genre" data-v="">Все жанры</button>` +
    genres.map(([g, n]) => `<button class="fchip" data-f="genre" data-v="${escapeAttr(g)}">${escapeHtml(g)}<span class="n">${n}</span></button>`).join("");

  $$(".fchip").forEach((chip) => chip.addEventListener("click", () => onFilter(chip)));
  syncChips();
}

function onFilter(chip) {
  const f = chip.dataset.f, v = chip.dataset.v;
  if (f === "free" || f === "isNew") state[f] = !state[f];
  else state[f] = state[f] === v ? "" : v;
  state.page = 1;
  syncChips();
  loadCatalog();
}

function syncChips() {
  $$(".fchip").forEach((chip) => {
    const f = chip.dataset.f, v = chip.dataset.v;
    let on = false;
    if (f === "free" || f === "isNew") on = state[f];
    else on = state[f] === v;
    chip.classList.toggle("active", on);
  });
}

/* ---------- Catalog ---------- */
function cardHTML(card, source) {
  // generated/AI single card (no facet fields)
  if (source === "generated" || source === "ai" || card.ai) {
    const badge = card.ai ? '<span class="cbadge new">AI</span>' : '<span class="cbadge">generated</span>';
    const metaLine = [card.genre, card.key, card.bpm ? card.bpm + " BPM" : null].filter(Boolean).join(" · ");
    return wrapCard(card, `<div class="card-badges">${badge}</div>`, metaLine, card.prompt, false);
  }
  const badges = [
    `<span class="cbadge">${escapeHtml(card.era || "")}</span>`,
    `<span class="cbadge lang">${escapeHtml((card.language || "").toUpperCase())}</span>`,
    card.isNew ? '<span class="cbadge new">Новинка</span>' : "",
    card.free ? '<span class="cbadge free">FREE</span>' : ""
  ].join("");
  const metaLine = [card.genre, card.key, card.bpm ? card.bpm + " BPM" : null].filter(Boolean).join(" · ");
  return wrapCard(card, `<div class="card-badges">${badges}</div>`, metaLine, card.prompt, card.locked, card.subgenre);
}

function wrapCard(card, badgesHTML, metaLine, prompt, locked, subgenre) {
  const saved = isSaved(card.id);
  const body = locked
    ? `<div class="prompt">${"locked ".repeat(14)}</div>
       <div class="lock-overlay"><span class="lk">🔒</span><b>ЗАБЛОКИРОВАНО</b><small>Unlock all to reveal this prompt</small></div>`
    : `<div class="prompt">${escapeHtml(prompt)}</div>
       <div class="card-actions">
         <button class="copy" data-prompt="${escapeAttr(prompt)}">Copy prompt</button>
         ${(!locked && canGenerate) ? `<button class="gen-track-btn" data-prompt="${escapeAttr(prompt)}" data-name="${escapeAttr(card.name)}" title="Сгенерировать трек в Suno">🎵 Создать трек</button>` : ""}
       </div>`;
  return `
    <div class="card ${locked ? "locked" : ""}">
      ${badgesHTML}
      <h3>${escapeHtml(card.name)}
        <button class="star ${saved ? "on" : ""}" data-id="${escapeAttr(card.id)}"
          data-name="${escapeAttr(card.name)}" data-prompt="${escapeAttr(prompt || "")}"
          data-genre="${escapeAttr(card.genre || "")}" ${locked ? "disabled title='unlock first'" : ""}>★</button>
      </h3>
      ${subgenre ? `<div class="sub-genre">${escapeHtml(subgenre)}</div>` : ""}
      <div class="meta">${escapeHtml(metaLine)}</div>
      ${body}
      <div class="tags">${(card.tags || []).slice(0, 4).map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join("")}</div>
    </div>`;
}

function wireCards(root) {
  wireCopyButtons(root);
  root.querySelectorAll(".star").forEach((btn) => btn.addEventListener("click", () => {
    if (btn.disabled) return;
    toggleSave({ id: btn.dataset.id, name: btn.dataset.name, prompt: btn.dataset.prompt, genre: btn.dataset.genre });
    btn.classList.toggle("on");
  }));
  root.querySelectorAll(".gen-track-btn").forEach((btn) => btn.addEventListener("click", () => {
    openGenModal(btn.dataset.prompt, btn.dataset.name);
  }));
}

/* ---------- Generate-track modal ---------- */
function openGenModal(prompt, name) {
  let modal = $("#gen-modal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "gen-modal";
    modal.className = "gen-modal";
    modal.innerHTML = `
      <div class="gen-modal-box">
        <button class="gen-modal-close" id="gen-modal-close">✕</button>
        <h2>🎵 Создать трек</h2>
        <div class="gen-modal-name" id="gen-modal-name"></div>
        <div class="gen-modal-prompt" id="gen-modal-prompt"></div>
        <div class="gen-opts" style="margin-top:12px">
          <label>Модель<select id="gm-mv"><option value="chirp-v5">v5</option><option value="chirp-v5-5">v5.5</option><option value="chirp-v4-5+">v4.5+</option></select></label>
          <label>Вокал<select id="gm-vocal"><option value="">любой</option><option value="Female">женский</option><option value="Male">мужской</option></select></label>
          <label class="check"><input id="gm-instr" type="checkbox" /> Инструментал</label>
        </div>
        <button id="gen-modal-btn" class="primary" style="margin-top:14px;width:100%">🎵 Сгенерировать (≈6 quota)</button>
        <div id="gen-modal-out" class="output"></div>
      </div>`;
    document.body.appendChild(modal);
    $("#gen-modal-close").addEventListener("click", () => modal.classList.remove("open"));
    modal.addEventListener("click", (e) => { if (e.target === modal) modal.classList.remove("open"); });
  }
  $("#gen-modal-name").textContent = name || "";
  $("#gen-modal-prompt").textContent = prompt || "";
  $("#gen-modal-out").innerHTML = "";
  $("#gen-modal-btn").disabled = false;
  modal.classList.add("open");

  // wire button (remove previous listener)
  const newBtn = $("#gen-modal-btn").cloneNode(true);
  $("#gen-modal-btn").replaceWith(newBtn);
  newBtn.addEventListener("click", async () => {
    newBtn.disabled = true;
    const out = $("#gen-modal-out");
    out.innerHTML = `<div class="spinner">Отправляю в Suno…</div>`;
    try {
      const data = await aiCall("/api/ai/generate-track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tags: prompt,
          mv: $("#gm-mv").value,
          vocalGender: $("#gm-vocal").value || undefined,
          instrumental: $("#gm-instr").checked
        })
      });
      if (!data.ok) throw new Error(data.error);
      pollModalTrack(data.jobId, out, newBtn);
    } catch (err) {
      out.innerHTML = `<div class="error">${escapeHtml(err.message)}</div>`;
      newBtn.disabled = false;
    }
  });
}

function pollModalTrack(jobId, out, btn) {
  out.innerHTML = `<div class="spinner">Suno генерирует… <span id="gm-prog">0%</span> <span class="muted">(30–90 сек)</span></div>`;
  let elapsed = 0;
  const iv = setInterval(async () => {
    elapsed += 5;
    try {
      const job = await api(`/api/ai/track-status?jobId=${encodeURIComponent(jobId)}`);
      const p = out.querySelector("#gm-prog"); if (p && job.progress) p.textContent = job.progress;
      if (job.status === "SUCCESS" && job.musics?.length) {
        clearInterval(iv); btn.disabled = false;
        out.innerHTML = `<div class="ai-result">${job.musics.map((m) => `
          <div class="track-card">
            ${m.imageUrl ? `<img class="track-art" src="${escapeAttr(m.imageUrl)}" alt="art"/>` : ""}
            <div class="track-info">
              <div class="track-title">${escapeHtml(m.title || "Untitled")}</div>
              <div class="track-tags muted">${escapeHtml(m.tags || "")}${m.duration ? ` · ${Math.round(m.duration)}s` : ""}</div>
              <audio controls src="${escapeAttr(m.audioUrl)}"></audio>
              <div class="track-actions"><a href="${escapeAttr(m.audioUrl)}" download>⭳ MP3</a>${m.videoUrl ? `<a href="${escapeAttr(m.videoUrl)}" target="_blank">▦ Video</a>` : ""}</div>
            </div>
          </div>`).join("")}</div>`;
      } else if (job.status === "FAILED") {
        clearInterval(iv); btn.disabled = false;
        out.innerHTML = `<div class="error">Suno вернул ошибку</div>`;
      } else if (elapsed > 240) {
        clearInterval(iv); btn.disabled = false;
        out.innerHTML = `<div class="error">Слишком долго — попробуй ещё раз</div>`;
      }
    } catch (err) { clearInterval(iv); btn.disabled = false; out.innerHTML = `<div class="error">${escapeHtml(err.message)}</div>`; }
  }, 5000);
}

function qs() {
  const p = new URLSearchParams();
  if (state.language) p.set("language", state.language);
  if (state.era) p.set("era", state.era);
  if (state.genre) p.set("genre", state.genre);
  if (state.mood) p.set("mood", state.mood);
  if (state.free) p.set("free", "1");
  if (state.isNew) p.set("isNew", "1");
  if (state.q) p.set("q", state.q);
  p.set("page", state.page);
  const u = localStorage.getItem(UNLOCK_KEY);
  if (u) p.set("u", u);
  return p.toString();
}

async function loadCatalog() {
  const results = $("#results");
  results.innerHTML = spin("loading…");
  $("#pager").innerHTML = "";

  if (state.q && !state.language && !state.era && !state.genre && !state.mood && !state.free && !state.isNew) {
    // pure text search may also generate a card if nothing matches
    const data = await api("/api/catalog?" + qs());
    if (!data.results.length) {
      results.innerHTML = `<div class="card">${spin("generating card…")}</div>`;
      const gen = await api("/api/card/" + encodeURIComponent(state.q) + (localStorage.getItem(UNLOCK_KEY) ? "?u=" + localStorage.getItem(UNLOCK_KEY) : ""));
      results.innerHTML = cardHTML(gen.card, gen.source);
      wireCards(results);
      return;
    }
  }

  const data = await api("/api/catalog?" + qs());
  results.innerHTML = data.results.length
    ? data.results.map((c) => cardHTML(c, "catalog")).join("")
    : `<p class="muted">No styles match these filters.</p>`;
  wireCards(results);
  renderPager(data);
}

function renderPager(data) {
  if (data.pages <= 1) { $("#pager").innerHTML = ""; return; }
  $("#pager").innerHTML = `
    <button id="prev" ${data.page <= 1 ? "disabled" : ""}>← Prev</button>
    <span class="pinfo">Page ${data.page} / ${data.pages} · ${data.total} styles</span>
    <button id="next" ${data.page >= data.pages ? "disabled" : ""}>Next →</button>`;
  const prev = $("#prev"), next = $("#next");
  if (prev) prev.onclick = () => { state.page--; loadCatalog(); window.scrollTo({ top: 0, behavior: "smooth" }); };
  if (next) next.onclick = () => { state.page++; loadCatalog(); window.scrollTo({ top: 0, behavior: "smooth" }); };
}

$("#search-btn").addEventListener("click", () => { state.q = $("#search").value.trim(); state.page = 1; loadCatalog(); });
$("#search").addEventListener("keydown", (e) => { if (e.key === "Enter") { state.q = $("#search").value.trim(); state.page = 1; loadCatalog(); } });
$("#f-mood").addEventListener("change", () => { state.mood = $("#f-mood").value; state.page = 1; loadCatalog(); });

/* ---------- Unlock ---------- */
function renderUnlockPill() {
  const unlocked = !!localStorage.getItem(UNLOCK_KEY);
  const pill = $("#unlock-pill");
  pill.textContent = unlocked ? "✓ full access" : "🔒 free tier";
  pill.classList.toggle("live", unlocked);
  $("#unlock-btn").style.display = unlocked ? "none" : "";
}
$("#unlock-btn").addEventListener("click", async () => {
  const code = prompt("Enter unlock code (demo: SILICON-PRO or UNLOCK-ALL):");
  if (!code) return;
  const data = await api("/api/unlock", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code })
  });
  if (data.ok) { localStorage.setItem(UNLOCK_KEY, data.token); renderUnlockPill(); loadCatalog(); }
  else alert(data.error || "Invalid unlock code");
});

/* ---------- Vocal Anchor ---------- */
$("#anchor-btn").addEventListener("click", async () => {
  const body = { pitch: $("#ax-pitch").value, timbre: $("#ax-timbre").value, delivery: $("#ax-delivery").value,
    texture: $("#ax-texture").value, age: $("#ax-age").value, donor: $("#ax-donor").value };
  const data = await api("/api/vocal-anchor", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const out = $("#anchor-out");
  out.innerHTML = `<h4>Vocal anchor</h4><div class="prompt">${escapeHtml(data.suno)}</div>
    <button class="copy" data-prompt="${escapeAttr(data.suno)}" style="margin-top:12px">Copy</button>`;
  wireCopyButtons(out);
});

/* ---------- Reference Analysis ---------- */
const dropzone = $("#dropzone"), fileInput = $("#file");
let currentFile = null;
dropzone.addEventListener("click", () => fileInput.click());
["dragover", "dragenter"].forEach((ev) => dropzone.addEventListener(ev, (e) => { e.preventDefault(); dropzone.classList.add("drag"); }));
["dragleave", "drop"].forEach((ev) => dropzone.addEventListener(ev, (e) => { e.preventDefault(); dropzone.classList.remove("drag"); }));
dropzone.addEventListener("drop", (e) => { if (e.dataTransfer.files.length) setFile(e.dataTransfer.files[0]); });
fileInput.addEventListener("change", () => { if (fileInput.files.length) setFile(fileInput.files[0]); });
function setFile(f) { currentFile = f; $("#filename").textContent = `${f.name} · ${(f.size / 1048576).toFixed(1)} MB`; $("#analyze-btn").disabled = false; }

$("#analyze-btn").addEventListener("click", async () => {
  if (!currentFile) return;
  const out = $("#analyze-out");
  out.innerHTML = spin("reading audio & building prompt…");
  const fd = new FormData(); fd.append("file", currentFile);
  let data;
  try { const res = await fetch("/api/analyze", { method: "POST", body: fd }); data = await res.json(); if (data.error) throw new Error(data.error); }
  catch (err) { out.innerHTML = `<div class="prompt" style="color:var(--bad)">${escapeHtml(err.message || "Analysis failed")}</div>`; return; }
  const d = data.detected;
  const modeTag = data.mode === "ai" ? '<span class="mode-tag">AI-enhanced</span>' : data.mode === "metadata" ? '<span class="mode-tag">from real metadata</span>' : "";
  const cells = [["Genre", d.genre], ["Era", d.era], ["BPM", d.bpm || "—"],
    ["Duration", d.durationSec != null ? fmtDur(d.durationSec) : "—"],
    ["Bitrate", d.bitrate ? Math.round(d.bitrate / 1000) + " kbps" : "—"],
    ["Sample rate", d.sampleRate ? d.sampleRate / 1000 + " kHz" : "—"],
    ["Channels", d.channels === 1 ? "mono" : d.channels === 2 ? "stereo" : (d.channels || "—")],
    ["Codec", d.codec || "—"], ["Vocals", d.vocals || "—"]];
  out.innerHTML = `<h4>Detected ${modeTag}</h4>
    <div class="metagrid">${cells.map(([k, v]) => `<div><b>${k}</b>${escapeHtml(String(v))}</div>`).join("")}</div>
    <h4>Suno prompt</h4><div class="prompt">${escapeHtml(data.prompt)}</div>
    <button class="copy" data-prompt="${escapeAttr(data.prompt)}" style="margin:12px 0">Copy prompt</button>
    <h4>3 closest catalog styles</h4>
    <div class="closest">${data.closest.map((a) => `<div class="chip">${escapeHtml(a.name)}<small>${escapeHtml(a.genre)}</small></div>`).join("")}</div>`;
  wireCopyButtons(out);
});
function fmtDur(sec) { return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`; }

/* ---------- Cover ---------- */
$("#cover-btn").addEventListener("click", async () => {
  const body = { title: $("#cv-title").value || "Untitled", artist: $("#cv-artist").value || "Unknown Artist",
    genre: $("#cv-genre").value || "electronic", withLogo: $("#cv-logo").checked };
  const data = await api("/api/cover", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const out = $("#cover-out");
  out.innerHTML = `<h4>Palette</h4>
    <div class="swatches">${data.palette.map((c) => `<div class="swatch" style="background:${escapeAttr(c)}"></div>`).join("")}</div>
    <h4>Concept (2048×2048)</h4><div class="prompt">${escapeHtml(data.concept)}</div>
    <button class="copy" data-prompt="${escapeAttr(data.concept)}" style="margin-top:12px">Copy concept</button>`;
  wireCopyButtons(out);
});

/* ---------- Song Structure ---------- */
$("#structure-btn").addEventListener("click", async () => {
  const out = $("#structure-out"); out.innerHTML = spin("building…");
  const body = { style: $("#st-style").value, title: $("#st-title").value, preset: $("#st-preset").value };
  const data = await api("/api/song-structure", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const tag = data.mode === "ai" ? '<span class="mode-tag">AI</span>' : '<span class="mode-tag">template</span>';
  out.innerHTML = `<h4>Arrangement ${tag}</h4><pre>${escapeHtml(data.suno)}</pre>
    <button class="copy" data-prompt="${escapeAttr(data.suno)}" style="margin-top:12px">Copy</button>`;
  wireCopyButtons(out);
});

/* ---------- Lyrics ---------- */
$("#lyrics-btn").addEventListener("click", async () => {
  const out = $("#lyrics-out"); out.innerHTML = spin("writing…");
  const body = { theme: $("#ly-theme").value || "the open road", style: $("#ly-style").value,
    mood: $("#ly-mood").value || "hopeful", language: $("#ly-lang").value || "English" };
  const data = await api("/api/lyrics", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const tag = data.mode === "ai" ? '<span class="mode-tag">AI</span>' : '<span class="mode-tag">skeleton (add AI key for full lyrics)</span>';
  out.innerHTML = `<h4>Lyrics ${tag}</h4><pre>${escapeHtml(data.lyrics)}</pre>
    <button class="copy" data-prompt="${escapeAttr(data.lyrics)}" style="margin-top:12px">Copy</button>`;
  wireCopyButtons(out);
});

/* ---------- Saved tab ---------- */
function renderSaved() {
  const arr = getSaved();
  $("#saved-count").textContent = `${arr.length} saved`;
  const list = $("#saved-list");
  if (!arr.length) { list.innerHTML = `<p class="muted">Nothing saved yet. Tap ★ on any prompt to keep it here.</p>`; return; }
  list.innerHTML = arr.map((s) => `
    <div class="card">
      <h3>${escapeHtml(s.name)}
        <button class="star on" data-del="${escapeAttr(s.id)}" title="remove">★</button>
      </h3>
      <div class="meta">${escapeHtml(s.genre || "")}</div>
      <div class="prompt">${escapeHtml(s.prompt)}</div>
      <button class="copy" data-prompt="${escapeAttr(s.prompt)}" style="margin-top:12px">Copy prompt</button>
    </div>`).join("");
  wireCopyButtons(list);
  list.querySelectorAll(".star[data-del]").forEach((btn) => btn.addEventListener("click", () => {
    setSaved(getSaved().filter((s) => s.id !== btn.dataset.del)); renderSaved();
  }));
}
$("#clear-saved").addEventListener("click", () => { if (confirm("Clear all saved prompts?")) { setSaved([]); renderSaved(); } });
$("#export-json").addEventListener("click", () => download("siliconsense-prompts.json", JSON.stringify(getSaved(), null, 2)));
$("#export-txt").addEventListener("click", () =>
  download("siliconsense-prompts.txt", getSaved().map((s) => `### ${s.name} (${s.genre})\n${s.prompt}`).join("\n\n")));
function download(name, text) {
  const blob = new Blob([text], { type: "text/plain" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/* ---------- AI Lab — Reference → Track (TTAPI Sample) ---------- */
(function () {
  const dz = $("#ref-dropzone");
  const fileInput = $("#ref-file");
  const options = $("#ref-options");
  const btn = $("#ref-btn");
  const out = $("#ref-out");
  const weightInput = $("#ref-weight");
  const weightVal = $("#ref-weight-val");
  const disabledMsg = $("#ref-disabled");
  if (!btn) return;

  api("/api/status").then((s) => {
    if (!s.generate) { disabledMsg?.classList.remove("hidden"); }
  }).catch(() => {});

  // ── Mode tabs ──
  let activeMode = "file";
  document.querySelectorAll(".ref-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".ref-tab").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      activeMode = tab.dataset.mode;
      $("#ref-file-mode")?.classList.toggle("hidden", activeMode !== "file");
      $("#ref-mic-mode")?.classList.toggle("hidden", activeMode !== "mic");
    });
  });

  // ── File upload ──
  dz?.addEventListener("click", () => fileInput.click());
  dz?.addEventListener("dragover", (e) => { e.preventDefault(); dz.classList.add("drag"); });
  dz?.addEventListener("dragleave", () => dz.classList.remove("drag"));
  dz?.addEventListener("drop", (e) => {
    e.preventDefault(); dz.classList.remove("drag");
    if (e.dataTransfer.files[0]) { fileInput.files = e.dataTransfer.files; fileInput.dispatchEvent(new Event("change")); }
  });
  fileInput?.addEventListener("change", () => {
    const f = fileInput.files[0]; if (!f) return;
    $("#ref-filename").textContent = f.name;
    options?.classList.remove("hidden");
    loadRefAudio(f);
  });
  weightInput?.addEventListener("input", () => { if (weightVal) weightVal.textContent = weightInput.value; });

  // ── Waveform ──
  let audioDuration = 0;
  let wfDragging = null; // "l" | "r"
  const wfCanvas = $("#ref-waveform");
  const wfSel = $("#ref-wf-sel");
  const wfHandleL = $("#ref-wf-l");
  const wfHandleR = $("#ref-wf-r");
  const wfCursor = $("#ref-wf-cursor");
  const wfWrap = $("#ref-waveform-wrap");
  const audioPlayer = $("#ref-audio-player");
  const startInput = $("#ref-start");
  const endInput = $("#ref-end");

  function secToFrac(s) { return audioDuration > 0 ? Math.max(0, Math.min(1, s / audioDuration)) : 0; }
  function fracToSec(f) { return Math.round(f * audioDuration * 10) / 10; }

  function updateHandlePositions() {
    if (!wfWrap || !audioDuration) return;
    const W = wfWrap.offsetWidth;
    const lFrac = secToFrac(Number(startInput?.value || 0));
    const rFrac = secToFrac(Number(endInput?.value || 30));
    if (wfHandleL) wfHandleL.style.left = (lFrac * 100) + "%";
    if (wfHandleR) wfHandleR.style.left = (rFrac * 100) + "%";
    if (wfSel) {
      wfSel.style.left = (lFrac * 100) + "%";
      wfSel.style.width = ((rFrac - lFrac) * 100) + "%";
    }
    if ($("#ref-wf-l-label")) $("#ref-wf-l-label").textContent = Math.round(Number(startInput?.value || 0)) + "s";
    if ($("#ref-wf-r-label")) $("#ref-wf-r-label").textContent = Math.round(Number(endInput?.value || 30)) + "s";
  }

  function drawWaveform(audioBuffer) {
    if (!wfCanvas) return;
    const W = wfWrap?.offsetWidth || 600;
    wfCanvas.width = W;
    const H = wfCanvas.height;
    const ctx = wfCanvas.getContext("2d");
    const raw = audioBuffer.getChannelData(0);
    const step = Math.max(1, Math.floor(raw.length / W));
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "rgba(20,21,38,0.8)";
    ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < W; i++) {
      let mn = 0, mx = 0;
      for (let j = 0; j < step; j++) {
        const v = raw[i * step + j] || 0;
        if (v < mn) mn = v; if (v > mx) mx = v;
      }
      const top = H / 2 - mx * (H / 2 - 4);
      const bot = H / 2 - mn * (H / 2 - 4);
      const h = Math.max(1, bot - top);
      const alpha = 0.4 + Math.abs(mx - mn) * 0.6;
      ctx.fillStyle = `rgba(124,140,255,${alpha})`;
      ctx.fillRect(i, top, 1, h);
    }
  }

  async function loadRefAudio(file) {
    const url = URL.createObjectURL(file);
    if (audioPlayer) { audioPlayer.src = url; audioPlayer.load(); }
    try {
      const arrayBuf = await file.arrayBuffer();
      const actx = new (window.AudioContext || window.webkitAudioContext)();
      const audioBuffer = await actx.decodeAudioData(arrayBuf);
      audioDuration = audioBuffer.duration;
      if (endInput) endInput.value = Math.min(30, Math.round(audioDuration));
      if (startInput) startInput.value = 0;
      drawWaveform(audioBuffer);
      updateHandlePositions();
      if (wfWrap) wfWrap.classList.remove("hidden");
    } catch (e) {
      console.warn("Waveform decode failed:", e.message);
      if (endInput) endInput.value = 30;
      if (startInput) startInput.value = 0;
    }
  }

  // Drag handles
  function onWfMouseDown(e, side) {
    wfDragging = side; e.preventDefault();
  }
  wfHandleL?.addEventListener("mousedown", (e) => onWfMouseDown(e, "l"));
  wfHandleR?.addEventListener("mousedown", (e) => onWfMouseDown(e, "r"));
  wfHandleL?.addEventListener("touchstart", (e) => { wfDragging = "l"; }, { passive: true });
  wfHandleR?.addEventListener("touchstart", (e) => { wfDragging = "r"; }, { passive: true });

  function getWfFrac(e) {
    const rect = wfWrap.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  }

  function onWfMove(e) {
    if (!wfDragging || !audioDuration) return;
    const frac = getWfFrac(e);
    const sec = fracToSec(frac);
    const lSec = Number(startInput?.value || 0);
    const rSec = Number(endInput?.value || 30);
    if (wfDragging === "l") {
      if (sec < rSec - 1 && startInput) { startInput.value = sec; }
    } else {
      if (sec > lSec + 1 && sec <= audioDuration && endInput) { endInput.value = sec; }
    }
    updateHandlePositions();
  }
  document.addEventListener("mousemove", onWfMove);
  document.addEventListener("touchmove", onWfMove, { passive: true });
  document.addEventListener("mouseup", () => { wfDragging = null; });
  document.addEventListener("touchend", () => { wfDragging = null; });

  // Click on wrap → move nearest handle
  wfWrap?.addEventListener("click", (e) => {
    if (!audioDuration || wfDragging) return;
    const frac = getWfFrac(e);
    const sec = fracToSec(frac);
    const lSec = Number(startInput?.value || 0);
    const rSec = Number(endInput?.value || 30);
    if (Math.abs(sec - lSec) < Math.abs(sec - rSec)) {
      if (sec < rSec - 1 && startInput) startInput.value = sec;
    } else {
      if (sec > lSec + 1 && endInput) endInput.value = sec;
    }
    updateHandlePositions();
  });

  // Manual input changes sync → waveform
  startInput?.addEventListener("input", updateHandlePositions);
  endInput?.addEventListener("input", updateHandlePositions);

  // Playback cursor
  audioPlayer?.addEventListener("timeupdate", () => {
    if (!audioDuration || !wfCursor || !wfWrap) return;
    const frac = audioPlayer.currentTime / audioDuration;
    wfCursor.style.left = (frac * 100) + "%";
    wfCursor.style.display = "block";
  });

  // ── Mic recording ──
  let micRecorder = null, micChunks = [], micBlob = null, micTimerIv = null;
  const micBtn = $("#ref-mic-btn");
  const micTimer = $("#ref-mic-timer");
  const micSec = $("#ref-mic-sec");
  const micWave = $("#ref-mic-wave");
  const micPlayback = $("#ref-mic-playback");
  const micAudio = $("#ref-mic-audio");
  const micUseBtn = $("#ref-mic-use-btn");
  const micRedoBtn = $("#ref-mic-redo-btn");
  const micName = $("#ref-mic-name");

  function resetMic() {
    micBlob = null; micChunks = [];
    micPlayback?.classList.add("hidden");
    micBtn?.classList.remove("hidden");
    micTimer?.classList.add("hidden");
    micWave?.classList.add("hidden");
    if (micName) micName.textContent = "";
    options?.classList.add("hidden");
  }

  micBtn?.addEventListener("click", async () => {
    if (micRecorder?.state === "recording") {
      micRecorder.stop();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micChunks = [];
      micRecorder = new MediaRecorder(stream);
      micRecorder.ondataavailable = (e) => { if (e.data.size) micChunks.push(e.data); };
      micRecorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        micBlob = new Blob(micChunks, { type: "audio/webm" });
        micAudio.src = URL.createObjectURL(micBlob);
        micPlayback?.classList.remove("hidden");
        micBtn?.classList.add("hidden");
        micTimer?.classList.add("hidden");
        micWave?.classList.add("hidden");
        clearInterval(micTimerIv);
        if (micName) micName.textContent = `Запись: ${Math.round(micBlob.size / 1024)} KB`;
      };
      micRecorder.start();
      micBtn.textContent = "⏹ Стоп";
      micTimer?.classList.remove("hidden");
      micWave?.classList.remove("hidden");
      let secs = 0;
      if (micSec) micSec.textContent = 0;
      micTimerIv = setInterval(() => { secs++; if (micSec) micSec.textContent = secs; if (secs >= 120) micRecorder.stop(); }, 1000);
    } catch (e) {
      out.innerHTML = `<div class="error">Нет доступа к микрофону: ${escapeHtml(e.message)}</div>`;
    }
  });

  micUseBtn?.addEventListener("click", () => {
    if (!micBlob) return;
    options?.classList.remove("hidden");
    const f = new File([micBlob], "mic-reference.webm", { type: micBlob.type });
    loadRefAudio(f);
    if (micName) micName.textContent += " · готово к отправке ✓";
  });

  micRedoBtn?.addEventListener("click", () => {
    micBtn.textContent = "🎙 Начать запись";
    resetMic();
  });

  // ── Submit ──
  btn?.addEventListener("click", async () => {
    let f = null;
    if (activeMode === "file") {
      f = fileInput?.files[0];
      if (!f) { out.innerHTML = `<div class="error">Загрузи аудио-файл</div>`; return; }
    } else {
      if (!micBlob) { out.innerHTML = `<div class="error">Сначала запиши референс с микрофона и нажми «Использовать»</div>`; return; }
      f = new File([micBlob], "mic-reference.webm", { type: micBlob.type });
    }
    if (!f) return;
    out.innerHTML = `<div class="spinner">Загружаю референс в Suno… <span class="muted">(шаг 1 из 2)</span></div>`;
    btn.disabled = true;
    try {
      const fd = new FormData();
      fd.append("audio", f);
      fd.append("startSec", $("#ref-start")?.value || "0");
      fd.append("endSec", $("#ref-end")?.value || "30");
      fd.append("audioWeight", weightInput?.value || "0.7");
      fd.append("mv", $("#ref-mv")?.value || "chirp-v5");
      const vocal = $("#ref-vocal")?.value;
      if (vocal) fd.append("vocalGender", vocal);
      if ($("#ref-instr")?.checked) fd.append("instrumental", "true");
      const desc = $("#ref-desc")?.value?.trim();
      if (desc) fd.append("description", desc);

      const data = await aiCall("/api/ai/reference-generate", { method: "POST", body: fd });
      if (!data.ok) throw new Error(data.error);
      out.innerHTML = `<div class="spinner">Референс загружен, Suno генерирует трек… <span id="ref-prog">0%</span> <span class="muted">(30–90 сек)</span></div>`;
      pollRef(data.jobId);
    } catch (err) {
      out.innerHTML = `<div class="error">${escapeHtml(err.message)}</div>`;
      btn.disabled = false;
    }
  });

  function pollRef(jobId) {
    let elapsed = 0;
    const iv = setInterval(async () => {
      elapsed += 5;
      try {
        const job = await api(`/api/ai/track-status?jobId=${encodeURIComponent(jobId)}`);
        const p = $("#ref-prog"); if (p && job.progress) p.textContent = job.progress;
        if (job.status === "SUCCESS" && job.musics?.length) {
          clearInterval(iv); btn.disabled = false;
          out.innerHTML = `<div class="ai-result">${job.musics.map((m) => `
            <div class="track-card">
              ${m.imageUrl ? `<img class="track-art" src="${escapeAttr(m.imageUrl)}" alt="art"/>` : ""}
              <div class="track-info">
                <div class="track-title">${escapeHtml(m.title || "Reference Track")}</div>
                <div class="track-tags muted">${escapeHtml(m.tags || "")}${m.duration ? ` · ${Math.round(m.duration)}s` : ""}</div>
                <audio controls src="${escapeAttr(m.audioUrl)}"></audio>
                <div class="track-actions">
                  <a href="${escapeAttr(m.audioUrl)}" download>⭳ MP3</a>
                  ${m.videoUrl ? `<a href="${escapeAttr(m.videoUrl)}" target="_blank">▦ Video</a>` : ""}
                </div>
              </div>
            </div>`).join("")}</div>`;
        } else if (job.status === "FAILED") {
          clearInterval(iv); btn.disabled = false;
          out.innerHTML = `<div class="error">Ошибка генерации</div>`;
        } else if (elapsed > 300) {
          clearInterval(iv); btn.disabled = false;
          out.innerHTML = `<div class="error">Слишком долго — попробуй ещё раз</div>`;
        }
      } catch (e) { clearInterval(iv); btn.disabled = false; out.innerHTML = `<div class="error">${escapeHtml(e.message)}</div>`; }
    }, 5000);
  }
})();

/* ---------- AI Lab — Generate Track (TTAPI) ---------- */
(function () {
  const btn = $("#gen-btn");
  const input = $("#gen-input");
  const out = $("#gen-out");
  const disabledMsg = $("#gen-disabled");
  if (!btn) return;

  // Reveal "not configured" notice based on /api/status.generate
  api("/api/status").then((s) => {
    if (!s.generate) { disabledMsg.classList.remove("hidden"); btn.disabled = true; }
  }).catch(() => {});

  let polling = null;
  function stopPoll() { if (polling) { clearInterval(polling); polling = null; } }

  btn.addEventListener("click", async () => {
    const tags = input.value.trim();
    if (!tags) { out.innerHTML = `<div class="error">Вставь промпт</div>`; return; }
    stopPoll();
    out.innerHTML = `<div class="spinner">Отправляю в Suno…</div>`;
    btn.disabled = true;
    try {
      const data = await aiCall("/api/ai/generate-track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tags,
          lyrics: $("#gen-lyrics").value.trim() || undefined,
          title: $("#gen-title").value.trim() || undefined,
          mv: $("#gen-mv").value,
          vocalGender: $("#gen-vocal").value || undefined,
          instrumental: $("#gen-instr").checked
        })
      });
      if (!data.ok) throw new Error(data.error);
      pollTrack(data.jobId);
    } catch (err) {
      out.innerHTML = `<div class="error">${escapeHtml(err.message)}</div>`;
      btn.disabled = false;
    }
  });

  function pollTrack(jobId) {
    let elapsed = 0;
    out.innerHTML = `<div class="spinner">Suno генерирует трек… <span id="gen-prog">0%</span> <span class="muted">(обычно 30–90 сек)</span></div>`;
    polling = setInterval(async () => {
      elapsed += 5;
      try {
        const job = await api(`/api/ai/track-status?jobId=${encodeURIComponent(jobId)}`);
        if (job.progress) { const p = $("#gen-prog"); if (p) p.textContent = job.progress; }
        if (job.status === "SUCCESS" && job.musics?.length) {
          stopPoll(); btn.disabled = false;
          out.innerHTML = `<div class="ai-result">${job.musics.map(renderTrack).join("")}</div>`;
        } else if (job.status === "FAILED") {
          stopPoll(); btn.disabled = false;
          out.innerHTML = `<div class="error">Suno вернул ошибку генерации</div>`;
        } else if (elapsed > 240) {
          stopPoll(); btn.disabled = false;
          out.innerHTML = `<div class="error">Слишком долго — попробуй ещё раз</div>`;
        }
      } catch (err) {
        stopPoll(); btn.disabled = false;
        out.innerHTML = `<div class="error">${escapeHtml(err.message)}</div>`;
      }
    }, 5000);
  }

  function renderTrack(m) {
    return `
      <div class="track-card">
        ${m.imageUrl ? `<img class="track-art" src="${escapeAttr(m.imageUrl)}" alt="art" />` : ""}
        <div class="track-info">
          <div class="track-title">${escapeHtml(m.title || "Untitled")}</div>
          <div class="track-tags muted">${escapeHtml(m.tags || "")}${m.duration ? ` · ${Math.round(m.duration)}s` : ""}</div>
          <audio controls src="${escapeAttr(m.audioUrl)}"></audio>
          <div class="track-actions">
            <a class="small" href="${escapeAttr(m.audioUrl)}" download>⭳ MP3</a>
            ${m.videoUrl ? `<a class="small" href="${escapeAttr(m.videoUrl)}" target="_blank">▦ Video</a>` : ""}
          </div>
        </div>
      </div>`;
  }
})();

/* ---------- AI Lab — Style Time Machine ---------- */
(function () {
  const artistInput = $("#tm-artist");
  const noteInput = $("#tm-note");
  const btn = $("#tm-btn");
  const out = $("#tm-out");
  if (!btn) return;

  let selectedEra = "";
  document.querySelectorAll(".era-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      document.querySelectorAll(".era-chip").forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      selectedEra = chip.dataset.era;
    });
  });

  btn.addEventListener("click", async () => {
    const artist = artistInput.value.trim();
    if (!artist) { out.innerHTML = `<div class="error">Введи имя артиста</div>`; return; }
    if (!selectedEra) { out.innerHTML = `<div class="error">Выбери эпоху</div>`; return; }
    out.innerHTML = `<div class="spinner">Машина времени запущена… Claude переносит ${escapeHtml(artist)} в ${escapeHtml(selectedEra)}…</div>`;
    btn.disabled = true;
    try {
      const data = await aiCall("/api/ai/time-machine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ artist, era: selectedEra, note: noteInput.value.trim() || undefined })
      });
      if (!data.ok) throw new Error(data.error);
      out.innerHTML = renderTimeMachine(data);
      wireCopyButtons(out);
      out.querySelectorAll(".gen-track-btn").forEach((b) =>
        b.addEventListener("click", () => openGenModal(b.dataset.prompt, b.dataset.name)));
    } catch (err) {
      out.innerHTML = `<div class="error">${escapeHtml(err.message)}</div>`;
    } finally { btn.disabled = false; }
  });

  function renderTimeMachine(d) {
    return `<div class="ai-result">
      <div class="tm-headline">${escapeHtml(d.artist)} × ${escapeHtml(d.targetEra)}</div>
      <div class="ai-atmo"><strong>Концепция:</strong> ${escapeHtml(d.concept)}</div>
      <div class="ai-prompt-box">
        <div class="prompt-label">Suno-промпт</div>
        <div class="prompt">${escapeHtml(d.prompt)}</div>
        <div class="card-actions">
          <button class="copy" data-prompt="${escapeAttr(d.prompt)}">Copy</button>
          ${canGenerate ? `<button class="gen-track-btn" data-prompt="${escapeAttr(d.prompt)}" data-name="${escapeAttr(d.artist + " × " + d.targetEra)}">🎵 Создать трек</button>` : ""}
        </div>
      </div>
      <div class="tm-split">
        <div>
          <div class="prompt-label">Из эпохи ${escapeHtml(d.targetEra)}</div>
          ${d.eraInstruments.map((i) => `<span class="tag inst">${escapeHtml(i)}</span>`).join(" ")}
          ${d.eraProduction ? `<div class="muted" style="font-size:12px;margin-top:6px">${escapeHtml(d.eraProduction)}</div>` : ""}
        </div>
        <div>
          <div class="prompt-label">Сохранено от ${escapeHtml(d.artist)}</div>
          ${d.retainedFromArtist.map((r) => `<span class="tag mood">${escapeHtml(r)}</span>`).join(" ")}
        </div>
      </div>
      <div class="ai-meta">
        ${d.bpm ? `<span class="tag">${d.bpm} BPM</span>` : ""}
        ${d.key ? `<span class="tag">${escapeHtml(d.key)}</span>` : ""}
        ${d.mood.map((m) => `<span class="tag mood">${escapeHtml(m)}</span>`).join("")}
      </div>
    </div>`;
  }
})();

/* ---------- AI Lab — Lyrics Sync Conductor ---------- */
(function () {
  const lyricsInput = $("#ls-lyrics");
  const styleInput = $("#ls-style");
  const btn = $("#ls-btn");
  const out = $("#ls-out");
  if (!btn) return;

  btn.addEventListener("click", async () => {
    const lyrics = lyricsInput.value.trim();
    if (!lyrics) { out.innerHTML = `<div class="error">Вставь лирику</div>`; return; }
    out.innerHTML = `<div class="spinner">Дирижирую эмоциональным арком…</div>`;
    btn.disabled = true;
    try {
      const data = await aiCall("/api/ai/lyrics-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lyrics, style: styleInput.value.trim() || undefined })
      });
      if (!data.ok) throw new Error(data.error);
      out.innerHTML = renderLyricsSync(data);
      wireCopyButtons(out);
    } catch (err) {
      out.innerHTML = `<div class="error">${escapeHtml(err.message)}</div>`;
    } finally { btn.disabled = false; }
  });

  function renderLyricsSync(d) {
    return `<div class="ai-result">
      <div class="ai-prompt-box">
        <div class="prompt-label">Лирика с тегами <span class="ok">· ${d.tagsAdded.length} тегов добавлено</span></div>
        <pre class="prompt struct">${escapeHtml(d.tagged)}</pre>
        <button class="copy" data-prompt="${escapeAttr(d.tagged)}">Copy в Suno</button>
      </div>
      ${d.tagsAdded.length ? `
      <div class="ls-tags-list">
        <div class="prompt-label">Что и почему</div>
        ${d.tagsAdded.map((t) => `
          <div class="ls-tag-row">
            <code class="ls-tag-name">${escapeHtml(t.tag)}</code>
            <span class="ls-tag-why">${escapeHtml(t.why || "")}</span>
          </div>`).join("")}
      </div>` : ""}
      ${d.tip ? `<div class="dna-note">💡 ${escapeHtml(d.tip)}</div>` : ""}
    </div>`;
  }
})();

/* ---------- AI Lab — Track DNA Decoder ---------- */
(function () {
  const dz = $("#dna-dropzone");
  const fileInput = $("#dna-file");
  const btn = $("#dna-btn");
  const out = $("#dna-out");
  if (!dz) return;

  dz.addEventListener("click", () => fileInput.click());
  dz.addEventListener("dragover", (e) => { e.preventDefault(); dz.classList.add("drag"); });
  dz.addEventListener("dragleave", () => dz.classList.remove("drag"));
  dz.addEventListener("drop", (e) => {
    e.preventDefault(); dz.classList.remove("drag");
    if (e.dataTransfer.files[0]) { fileInput.files = e.dataTransfer.files; fileInput.dispatchEvent(new Event("change")); }
  });
  fileInput.addEventListener("change", () => {
    const f = fileInput.files[0]; if (!f) return;
    $("#dna-filename").textContent = f.name;
    btn.disabled = false;
  });

  btn.addEventListener("click", async () => {
    const f = fileInput.files[0]; if (!f) return;
    out.innerHTML = `<div class="dna-steps">
      <div class="dna-step active" id="ds1">📦 Читаю метаданные…</div>
      <div class="dna-step" id="ds2">🎤 Whisper слушает лирику…</div>
      <div class="dna-step" id="ds3">🧠 Claude строит ДНК-отчёт…</div>
    </div>`;
    btn.disabled = true;

    // Animate steps — they're sequential on server so simulate timing
    const steps = [1, 2, 3];
    let si = 0;
    const stepIv = setInterval(() => {
      if (si < steps.length) {
        const prev = out.querySelector(`#ds${steps[si]}`);
        if (prev) prev.classList.add("done");
        si++;
        const cur = out.querySelector(`#ds${steps[si]}`);
        if (cur) cur.classList.add("active");
      }
    }, 4000);

    try {
      const fd = new FormData();
      fd.append("file", f);
      const data = await aiCall("/api/ai/dna-decode", { method: "POST", body: fd });
      clearInterval(stepIv);
      if (!data.ok) throw new Error(data.error);
      out.innerHTML = renderDNA(data);
      wireCopyButtons(out);
      // Wire generate buttons inside DNA result
      out.querySelectorAll(".gen-track-btn").forEach((b) => {
        b.addEventListener("click", () => openGenModal(b.dataset.prompt, b.dataset.name));
      });
    } catch (err) {
      clearInterval(stepIv);
      out.innerHTML = `<div class="error">${escapeHtml(err.message)}</div>`;
    } finally { btn.disabled = false; }
  });

  function renderDNA(d) {
    const a = d.analysis || {};
    const tags = [
      a.era && `<span class="tag">${escapeHtml(a.era)}</span>`,
      a.genre && `<span class="tag">${escapeHtml(a.genre)}</span>`,
      a.subgenre && `<span class="tag">${escapeHtml(a.subgenre)}</span>`,
      a.bpm && `<span class="tag">${a.bpm} BPM</span>`,
      a.key && `<span class="tag">${escapeHtml(a.key)}</span>`,
      ...(a.mood || []).map((m) => `<span class="tag mood">${escapeHtml(m)}</span>`),
      ...(a.instruments || []).slice(0, 4).map((i) => `<span class="tag inst">${escapeHtml(i)}</span>`)
    ].filter(Boolean).join("");

    const closestHTML = (d.closest || []).map((c) => `
      <div class="dna-match">
        <div class="dna-match-name">${escapeHtml(c.name)}</div>
        <div class="dna-match-reason muted">${escapeHtml(c.reason || "")}</div>
        ${c.prompt ? `
          <div class="dna-match-prompt">${escapeHtml(c.prompt)}</div>
          <div class="dna-match-actions">
            <button class="copy" data-prompt="${escapeAttr(c.prompt)}">Copy prompt</button>
            ${canGenerate ? `<button class="gen-track-btn" data-prompt="${escapeAttr(c.prompt)}" data-name="${escapeAttr(c.name)}">🎵 Создать трек</button>` : ""}
          </div>` : ""}
      </div>`).join("");

    const meta = d.meta || {};
    const metaLine = [
      meta.codec && escapeHtml(meta.codec),
      meta.bitrate && `${Math.round(meta.bitrate / 1000)}kbps`,
      meta.sampleRate && `${meta.sampleRate / 1000}kHz`,
      meta.duration && `${Math.floor(meta.duration / 60)}:${String(meta.duration % 60).padStart(2, "0")}`
    ].filter(Boolean).join(" · ");

    return `<div class="ai-result dna-result">

      <div class="dna-section">
        <div class="prompt-label">Технические данные</div>
        <div class="muted" style="font-size:12px">${metaLine || "—"}</div>
      </div>

      <div class="dna-section">
        <div class="prompt-label">Анализ трека</div>
        <div class="ai-meta">${tags}</div>
        ${a.vocals ? `<div style="margin-top:8px;font-size:13px"><b>Вокал:</b> ${escapeHtml(a.vocals)}</div>` : ""}
        ${a.production ? `<div style="font-size:13px"><b>Продакшн:</b> ${escapeHtml(a.production)}</div>` : ""}
        ${a.producerNote ? `<div class="dna-note">💬 ${escapeHtml(a.producerNote)}</div>` : ""}
      </div>

      ${d.transcript ? `<div class="dna-section">
        <div class="prompt-label">Лирика (Whisper)</div>
        <div class="dna-lyrics">${escapeHtml(d.transcript.slice(0, 400))}${d.transcript.length > 400 ? "…" : ""}</div>
      </div>` : ""}

      <div class="ai-prompt-box">
        <div class="prompt-label">Готовый Suno-промпт</div>
        <div class="prompt">${escapeHtml(d.sunoPrompt)}</div>
        <div class="card-actions">
          <button class="copy" data-prompt="${escapeAttr(d.sunoPrompt)}">Copy</button>
          ${canGenerate ? `<button class="gen-track-btn" data-prompt="${escapeAttr(d.sunoPrompt)}" data-name="DNA Decode">🎵 Создать трек</button>` : ""}
        </div>
      </div>

      <div class="dna-section">
        <div class="prompt-label">🎯 Ближайшие артисты в каталоге</div>
        <div class="dna-matches">${closestHTML}</div>
      </div>
    </div>`;
  }
})();

/* ---------- AI Lab — Anti-Slop scorer (client-side, instant) ---------- */
const SLOP_WEAK = [
  "beautiful","epic","cool","vibey","amazing","awesome","nice","great","good",
  "powerful drums","powerful","emotional","catchy","banger","fire","vibe","energy",
  "cinematic","orchestral","melodic","atmospheric","ethereal","dreamy","chill",
  "sad","happy","dark","heavy","intense","smooth","groovy","fresh","modern"
];
const SLOP_CLICHE_COMBOS = [
  ["epic","cinematic"], ["cinematic","orchestral"], ["epic","orchestral"],
  ["sad","piano"], ["melancholic","piano"], ["emotional","piano"],
  ["dark","trap"], ["melodic","trap"], ["hard","808"],
  ["beautiful","emotional"], ["powerful","emotional"],
];
function scorePrompt(text) {
  const t = text.toLowerCase();
  const tokens = t.split(/[,;.\n]+/).map((s) => s.trim()).filter(Boolean);
  const words = t.split(/\s+/);
  let score = 100;
  const flags = [];

  // weak/vague tokens
  for (const w of SLOP_WEAK) {
    const re = new RegExp(`(^|[\\s,])${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([\\s,]|$)`, "i");
    if (re.test(t)) { score -= 6; flags.push({ token: w, type: "weak" }); }
  }
  // cliché combos
  for (const [a, b] of SLOP_CLICHE_COMBOS) {
    if (t.includes(a) && t.includes(b)) { score -= 10; flags.push({ token: `${a} + ${b}`, type: "cliche" }); }
  }
  // structural bonuses
  const hasBpm = /\b\d{2,3}\s?bpm\b/i.test(t);
  const hasKey = /\b[a-g](\s?(#|sharp|flat|b))?\s?(major|minor|maj|min)\b/i.test(t) || /maqam|raag/i.test(t);
  const tokenCount = tokens.length;
  if (!hasBpm) { score -= 12; flags.push({ token: "нет BPM", type: "missing" }); }
  if (!hasKey) { score -= 10; flags.push({ token: "нет тональности", type: "missing" }); }
  if (tokenCount < 4) { score -= 10; flags.push({ token: `мало токенов (${tokenCount})`, type: "structure" }); }
  if (tokenCount > 14) { score -= 8; flags.push({ token: `перегруз (${tokenCount} токенов)`, type: "structure" }); }
  if (words.length > 90) { score -= 6; flags.push({ token: "слишком длинный", type: "structure" }); }

  score = Math.max(0, Math.min(100, score));
  return { score, flags, hasBpm, hasKey, tokenCount };
}
(function () {
  const input = $("#slop-input");
  const meter = $("#slop-meter");
  const scoreEl = $("#slop-score");
  const bar = $("#slop-bar");
  const flagsEl = $("#slop-flags");
  const btn = $("#slop-btn");
  const out = $("#slop-out");
  if (!input) return;

  function color(score) {
    if (score >= 75) return "#50fa7b";
    if (score >= 50) return "#ffb86c";
    return "#ff6b6b";
  }
  function update() {
    const text = input.value.trim();
    if (!text) { meter.classList.add("hidden"); btn.disabled = true; return; }
    meter.classList.remove("hidden");
    btn.disabled = false;
    const { score, flags } = scorePrompt(text);
    scoreEl.textContent = score;
    scoreEl.style.color = color(score);
    bar.style.width = score + "%";
    bar.style.background = color(score);
    flagsEl.innerHTML = flags.length
      ? flags.map((f) => `<span class="slop-flag ${f.type}">${escapeHtml(f.token)}</span>`).join("")
      : `<span class="slop-flag ok">✓ чисто, штампов не найдено</span>`;
  }
  input.addEventListener("input", update);

  btn.addEventListener("click", async () => {
    const prompt = input.value.trim();
    if (!prompt) return;
    const { flags } = scorePrompt(prompt);
    out.innerHTML = `<div class="spinner">AI переписывает штампы в конкретику…</div>`;
    btn.disabled = true;
    try {
      const data = await aiCall("/api/ai/anti-slop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, flagged: flags.map((f) => f.token) })
      });
      if (!data.ok) throw new Error(data.error);
      const newScore = scorePrompt(data.rewritten).score;
      out.innerHTML = `
        <div class="ai-result">
          <div class="ai-prompt-box">
            <div class="prompt-label">Починенный промпт <span class="ok">· ${newScore}/100</span></div>
            <div class="prompt">${escapeHtml(data.rewritten)}</div>
            <button class="copy" data-prompt="${escapeAttr(data.rewritten)}">Copy</button>
          </div>
          ${data.changes.length ? `<div class="slop-changes">
            <div class="prompt-label">Что заменено</div>
            ${data.changes.map((c) => `<div class="slop-change"><s>${escapeHtml(c.from)}</s> → <b>${escapeHtml(c.to)}</b><span class="why">${escapeHtml(c.why || "")}</span></div>`).join("")}
          </div>` : ""}
        </div>`;
      wireCopyButtons(out);
    } catch (err) {
      out.innerHTML = `<div class="error">${escapeHtml(err.message)}</div>`;
    } finally { btn.disabled = false; }
  });
})();

/* ---------- AI Lab — Voice Memo ---------- */
(function () {
  const recordBtn = $("#voice-record-btn");
  const sendBtn = $("#voice-send-btn");
  const redoBtn = $("#voice-redo-btn");
  const timerEl = $("#voice-timer");
  const secEl = $("#voice-sec");
  const waveEl = $("#voice-wave");
  const playbackEl = $("#voice-playback");
  const audioEl = $("#voice-audio");
  const out = $("#voice-out");
  if (!recordBtn) return;

  let mediaRecorder = null;
  let chunks = [];
  let timerInterval = null;
  let seconds = 0;
  let recordedBlob = null;

  function startTimer() {
    seconds = 0; secEl.textContent = 0;
    timerInterval = setInterval(() => { secEl.textContent = ++seconds; }, 1000);
  }
  function stopTimer() { clearInterval(timerInterval); }

  function resetUI() {
    playbackEl.classList.add("hidden");
    timerEl.classList.add("hidden");
    waveEl.classList.add("hidden");
    out.innerHTML = "";
    recordedBlob = null;
    recordBtn.textContent = "🎙 Начать запись";
    recordBtn.classList.remove("recording");
    sendBtn.disabled = false;
  }

  recordBtn.addEventListener("click", async () => {
    if (mediaRecorder && mediaRecorder.state === "recording") {
      mediaRecorder.stop();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunks = [];
      // prefer webm/opus, fallback to whatever browser supports
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm"
        : "audio/ogg";
      mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      mediaRecorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        stopTimer();
        waveEl.classList.add("hidden");
        timerEl.classList.add("hidden");
        recordedBlob = new Blob(chunks, { type: mimeType });
        audioEl.src = URL.createObjectURL(recordedBlob);
        playbackEl.classList.remove("hidden");
        recordBtn.textContent = "🎙 Начать запись";
        recordBtn.classList.remove("recording");
      };
      mediaRecorder.start(100);
      recordBtn.textContent = "⏹ Стоп";
      recordBtn.classList.add("recording");
      timerEl.classList.remove("hidden");
      waveEl.classList.remove("hidden");
      startTimer();
    } catch (err) {
      out.innerHTML = `<div class="error">Нет доступа к микрофону: ${escapeHtml(err.message)}</div>`;
    }
  });

  redoBtn?.addEventListener("click", resetUI);

  sendBtn?.addEventListener("click", async () => {
    if (!recordedBlob) return;
    out.innerHTML = `<div class="spinner">Whisper слушает… затем AI строит промпт…</div>`;
    sendBtn.disabled = true;
    try {
      const fd = new FormData();
      fd.append("audio", recordedBlob, "memo.webm");
      const data = await aiCall("/api/ai/voice-memo", { method: "POST", body: fd });
      if (!data.ok) throw new Error(data.error);
      out.innerHTML = `
        <div class="ai-result">
          <div class="ai-atmo"><strong>Я услышал:</strong> ${escapeHtml(data.transcript)}</div>
          <div class="ai-prompt-box">
            <div class="prompt-label">Suno-промпт</div>
            <div class="prompt">${escapeHtml(data.prompt)}</div>
            <button class="copy" data-prompt="${escapeAttr(data.prompt)}">Copy</button>
          </div>
          <div class="ai-meta">
            ${data.bpm ? `<span class="tag">${data.bpm} BPM</span>` : ""}
            ${data.key ? `<span class="tag">${escapeHtml(data.key)}</span>` : ""}
            ${data.era ? `<span class="tag">${escapeHtml(data.era)}</span>` : ""}
            ${data.vocals ? `<span class="tag">vocal: ${escapeHtml(data.vocals)}</span>` : ""}
            ${(data.mood || []).map((m) => `<span class="tag mood">${escapeHtml(m)}</span>`).join("")}
            ${(data.instruments || []).map((i) => `<span class="tag inst">${escapeHtml(i)}</span>`).join("")}
          </div>
        </div>`;
      wireCopyButtons(out);
    } catch (err) {
      out.innerHTML = `<div class="error">${escapeHtml(err.message)}</div>`;
    } finally { sendBtn.disabled = false; }
  });
})();

/* ---------- AI Lab ---------- */
function unlockHeader() {
  const tok = localStorage.getItem(UNLOCK_KEY);
  return tok ? { "X-Unlock-Token": tok } : {};
}
function renderQuota(headers) {
  const pill = $("#ailab-quota");
  if (!pill) return;
  if (headers.get("X-RateLimit-Unlocked") === "1") {
    pill.textContent = "● Unlocked — без лимита";
    pill.className = "quota-pill unlocked";
    return;
  }
  const remaining = headers.get("X-RateLimit-Remaining");
  const limit = headers.get("X-RateLimit-Limit");
  if (remaining != null && limit != null) {
    pill.textContent = `${remaining} из ${limit} бесплатных запросов осталось сегодня`;
    pill.className = "quota-pill";
  }
}
async function aiCall(url, opts = {}) {
  const headers = { ...(opts.headers || {}), ...unlockHeader() };
  const res = await fetch(url, { ...opts, headers });
  renderQuota(res.headers);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (data.unlock) {
      throw new Error(`${data.message || data.error}\nВведи unlock-код, чтобы продолжить.`);
    }
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return data;
}

// --- Mood from Image ---
const imgDz = $("#img-dropzone");
const imgFile = $("#img-file");
const imgBtn = $("#img-btn");
const imgPreview = $("#img-preview");
if (imgDz) {
  imgDz.addEventListener("click", () => imgFile.click());
  imgDz.addEventListener("dragover", (e) => { e.preventDefault(); imgDz.classList.add("drag"); });
  imgDz.addEventListener("dragleave", () => imgDz.classList.remove("drag"));
  imgDz.addEventListener("drop", (e) => {
    e.preventDefault(); imgDz.classList.remove("drag");
    if (e.dataTransfer.files[0]) { imgFile.files = e.dataTransfer.files; imgFile.dispatchEvent(new Event("change")); }
  });
  imgFile.addEventListener("change", () => {
    const f = imgFile.files[0]; if (!f) return;
    $("#img-filename").textContent = f.name;
    imgBtn.disabled = false;
    const reader = new FileReader();
    reader.onload = (e) => { imgPreview.src = e.target.result; imgPreview.classList.remove("hidden"); };
    reader.readAsDataURL(f);
  });
  imgBtn.addEventListener("click", async () => {
    const f = imgFile.files[0]; if (!f) return;
    const out = $("#img-out");
    out.innerHTML = `<div class="spinner">Claude Vision слушает картинку…</div>`;
    imgBtn.disabled = true;
    try {
      const fd = new FormData(); fd.append("image", f);
      const data = await aiCall("/api/ai/mood-from-image", { method: "POST", body: fd });
      if (!data.ok) throw new Error(data.error);
      out.innerHTML = renderMoodResult(data);
      wireCopyButtons(out);
    } catch (err) {
      out.innerHTML = `<div class="error">${escapeHtml(err.message)}</div>`;
    } finally { imgBtn.disabled = false; }
  });
}
function renderMoodResult(d) {
  return `
    <div class="ai-result">
      <div class="ai-atmo"><strong>Атмосфера:</strong> ${escapeHtml(d.atmosphere)}</div>
      <div class="ai-prompt-box">
        <div class="prompt-label">Suno-промпт</div>
        <div class="prompt">${escapeHtml(d.prompt)}</div>
        <button class="copy" data-prompt="${escapeAttr(d.prompt)}">Copy</button>
      </div>
      <div class="ai-meta">
        ${d.bpm ? `<span class="tag">${d.bpm} BPM</span>` : ""}
        ${d.key ? `<span class="tag">${escapeHtml(d.key)}</span>` : ""}
        ${d.vocal ? `<span class="tag">vocal: ${escapeHtml(d.vocal)}</span>` : ""}
        ${(d.mood || []).map((m) => `<span class="tag mood">${escapeHtml(m)}</span>`).join("")}
        ${(d.instruments || []).map((i) => `<span class="tag inst">${escapeHtml(i)}</span>`).join("")}
      </div>
    </div>`;
}

// --- Scene → Score ---
const sceneBtn = $("#scene-btn");
if (sceneBtn) {
  sceneBtn.addEventListener("click", async () => {
    const scene = $("#scene-input").value.trim();
    const out = $("#scene-out");
    if (!scene) { out.innerHTML = `<div class="error">Опиши сцену</div>`; return; }
    const lang = $("#scene-lang").checked ? "ru" : "en";
    out.innerHTML = `<div class="spinner">Claude собирает партитуру…</div>`;
    sceneBtn.disabled = true;
    try {
      const data = await aiCall("/api/ai/scene-to-score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scene, lang })
      });
      if (!data.ok) throw new Error(data.error);
      out.innerHTML = renderSceneResult(data);
      wireCopyButtons(out);
    } catch (err) {
      out.innerHTML = `<div class="error">${escapeHtml(err.message)}</div>`;
    } finally { sceneBtn.disabled = false; }
  });
}
function renderSceneResult(d) {
  return `
    <div class="ai-result">
      <div class="ai-prompt-box">
        <div class="prompt-label">Style (промпт)</div>
        <div class="prompt">${escapeHtml(d.prompt)}</div>
        <button class="copy" data-prompt="${escapeAttr(d.prompt)}">Copy style</button>
      </div>
      <div class="ai-prompt-box">
        <div class="prompt-label">Structure (для Lyrics-поля)</div>
        <pre class="prompt struct">${escapeHtml(d.structure)}</pre>
        <button class="copy" data-prompt="${escapeAttr(d.structure)}">Copy structure</button>
      </div>
      <div class="ai-meta">
        ${d.bpm ? `<span class="tag">${d.bpm} BPM</span>` : ""}
        ${d.key ? `<span class="tag">${escapeHtml(d.key)}</span>` : ""}
        ${(d.mood || []).map((m) => `<span class="tag mood">${escapeHtml(m)}</span>`).join("")}
        ${(d.instruments || []).map((i) => `<span class="tag inst">${escapeHtml(i)}</span>`).join("")}
      </div>
    </div>`;
}

// --- RU → EN Mirror ---
const transBtn = $("#trans-btn");
if (transBtn) {
  transBtn.addEventListener("click", async () => {
    const text = $("#trans-input").value.trim();
    const out = $("#trans-out");
    if (!text) { out.innerHTML = `<div class="error">Вставь русскую лирику</div>`; return; }
    out.innerHTML = `<div class="spinner">Зеркалю на английский с рифмой…</div>`;
    transBtn.disabled = true;
    try {
      const data = await aiCall("/api/ai/translate-lyrics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text })
      });
      if (!data.ok) throw new Error(data.error);
      out.innerHTML = `
        <div class="ai-result">
          <div class="ai-prompt-box">
            <div class="prompt-label">English mirror ${data.syllablesMatched ? "<span class='ok'>· syllables matched</span>" : ""}</div>
            <pre class="prompt struct">${escapeHtml(data.english)}</pre>
            <button class="copy" data-prompt="${escapeAttr(data.english)}">Copy English</button>
          </div>
          ${data.rhymeNotes ? `<div class="ai-atmo"><strong>Rhyme notes:</strong> ${escapeHtml(data.rhymeNotes)}</div>` : ""}
        </div>`;
      wireCopyButtons(out);
    } catch (err) {
      out.innerHTML = `<div class="error">${escapeHtml(err.message)}</div>`;
    } finally { transBtn.disabled = false; }
  });
}

/* ---------- AI Lab — Style Genome ---------- */
(function () {
  const container = document.getElementById("genome-artists");
  const addBtn = document.getElementById("genome-add");
  const totalEl = document.getElementById("genome-total");
  const btn = document.getElementById("genome-btn");
  const out = document.getElementById("genome-out");
  if (!btn) return;

  function updateTotal() {
    const weights = [...container.querySelectorAll(".genome-weight")].map((i) => Number(i.value) || 0);
    const sum = weights.reduce((a, b) => a + b, 0);
    totalEl.textContent = sum + "%";
    totalEl.className = "genome-total" + (sum === 100 ? " ok" : sum > 100 ? " over" : "");
  }

  container.addEventListener("input", updateTotal);

  addBtn.addEventListener("click", () => {
    if (container.querySelectorAll(".genome-row").length >= 3) return;
    const row = document.createElement("div");
    row.className = "genome-row";
    row.dataset.idx = "2";
    row.innerHTML = `
      <input class="genome-name" type="text" placeholder="Артист 3: финальный флейвор…" />
      <input class="genome-weight" type="number" min="1" max="99" value="10" />
      <span class="genome-pct">%</span>
      <button class="genome-remove ghost small">✕</button>`;
    row.querySelector(".genome-remove").addEventListener("click", () => {
      row.remove();
      addBtn.classList.remove("hidden");
      updateTotal();
    });
    container.appendChild(row);
    addBtn.classList.add("hidden");
    updateTotal();
  });

  btn.addEventListener("click", async () => {
    const rows = [...container.querySelectorAll(".genome-row")];
    const artists = rows.map((r) => ({
      name: r.querySelector(".genome-name").value.trim(),
      weight: Number(r.querySelector(".genome-weight").value) || 0
    })).filter((a) => a.name && a.weight > 0);

    if (artists.length < 2) { out.innerHTML = `<div class="error">Введи хотя бы 2 артиста с именем и весом</div>`; return; }

    out.innerHTML = `<div class="spinner">Скрещиваем ДНК: ${artists.map((a) => a.name).join(" × ")}…</div>`;
    btn.disabled = true;
    try {
      const data = await aiCall("/api/ai/style-genome", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ artists })
      });
      if (!data.ok) throw new Error(data.error);
      out.innerHTML = renderGenome(data, artists);
      wireCopyButtons(out);
      out.querySelectorAll(".gen-track-btn").forEach((b) =>
        b.addEventListener("click", () => openGenModal(b.dataset.prompt, b.dataset.name)));
    } catch (err) {
      out.innerHTML = `<div class="error">${escapeHtml(err.message)}</div>`;
    } finally { btn.disabled = false; }
  });

  function renderGenome(d, artists) {
    const title = artists.map((a) => a.name).join(" × ");
    return `<div class="ai-result">
      <div class="tm-headline">${escapeHtml(title)}</div>
      <div class="ai-atmo"><strong>Концепция:</strong> ${escapeHtml(d.concept)}</div>
      <div class="ai-prompt-box">
        <div class="prompt-label">Suno-промпт</div>
        <div class="prompt">${escapeHtml(d.prompt)}</div>
        <div class="card-actions">
          <button class="copy" data-prompt="${escapeAttr(d.prompt)}">Copy</button>
          ${canGenerate ? `<button class="gen-track-btn" data-prompt="${escapeAttr(d.prompt)}" data-name="${escapeAttr(title)}">🎵 Создать трек</button>` : ""}
        </div>
      </div>
      ${d.dnaBreakdown.length ? `
      <div class="prompt-label" style="margin-top:12px">ДНК по артистам</div>
      ${d.dnaBreakdown.map((b) => `
        <div class="genome-dna-row">
          <span class="genome-dna-name">${escapeHtml(b.artist)}</span>
          <span class="genome-dna-bar" style="width:${b.weight}%"></span>
          <span class="genome-dna-pct">${b.weight}%</span>
          <span class="genome-dna-contrib muted">${escapeHtml(b.contribution)}</span>
        </div>`).join("")}` : ""}
      <div class="ai-meta">
        ${d.bpm ? `<span class="tag">${d.bpm} BPM</span>` : ""}
        ${d.key ? `<span class="tag">${escapeHtml(d.key)}</span>` : ""}
        ${d.genre ? `<span class="tag">${escapeHtml(d.genre)}</span>` : ""}
        ${d.mood.map((m) => `<span class="tag mood">${escapeHtml(m)}</span>`).join("")}
        ${d.instruments.map((i) => `<span class="tag inst">${escapeHtml(i)}</span>`).join("")}
        ${d.vocals ? `<span class="tag">${escapeHtml(d.vocals)}</span>` : ""}
      </div>
    </div>`;
  }
})();

/* ---------- Init (after all declarations) ---------- */
if (localStorage.getItem(GATE_KEY)) showApp();
