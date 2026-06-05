const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);
const api = async (url, opts) => (await fetch(url, opts)).json();

const GATE_KEY = "siliconsense_token";
const UNLOCK_KEY = "siliconsense_unlock";
const SAVED_KEY = "siliconsense_saved";

const state = { language: "", era: "", genre: "", mood: "", q: "", free: false, isNew: false, page: 1 };
let facets = null;

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
       <button class="copy" data-prompt="${escapeAttr(prompt)}" style="margin-top:12px">Copy prompt</button>`;
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

/* ---------- Init (after all declarations) ---------- */
if (localStorage.getItem(GATE_KEY)) showApp();
