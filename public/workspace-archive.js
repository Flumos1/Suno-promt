// Suno's "Download All" archive is expanded in the browser. Its bytes never
// travel to this site's server; each entry is streamed to a user-picked folder.
const AUDIO_EXTENSIONS = new Set(["mp3", "wav", "m4a", "flac", "ogg", "aac", "mp4"]);

export function safeArchivePath(filename) {
  if (typeof filename !== "string" || !filename || /\0/.test(filename)) return null;
  const path = filename.replace(/\\/g, "/");
  if (path.startsWith("/") || /^[A-Za-z]:/.test(path)) return null;
  const parts = path.split("/").filter(Boolean);
  if (!parts.length || parts.some((part) => part === "." || part === "..")) return null;
  const cleaned = parts.map((part) => {
    let name = part.replace(/[<>:"|?*\u0000-\u001f]/g, "_").replace(/[. ]+$/g, "");
    if (/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(name)) name = `_${name}`;
    return name.slice(0, 180);
  });
  return cleaned.every(Boolean) ? cleaned : null;
}

export function listAudioEntries(entries) {
  const seen = new Set();
  const selected = [];
  for (const entry of entries) {
    if (entry.directory || entry.symlink || entry.encrypted) continue;
    const parts = safeArchivePath(entry.filename);
    if (!parts || !AUDIO_EXTENSIONS.has(parts.at(-1).split(".").at(-1).toLowerCase())) continue;
    const name = parts.at(-1);
    const dot = name.lastIndexOf(".");
    const stem = name.slice(0, dot);
    const ext = name.slice(dot);
    let index = 2;
    while (seen.has(parts.join("/").toLowerCase())) {
      parts[parts.length - 1] = `${stem} (${index++})${ext}`;
    }
    seen.add(parts.join("/").toLowerCase());
    selected.push({ entry, parts });
  }
  return selected;
}

export async function extractSelectedEntries(selected, destination, archiveName, onprogress = () => {}) {
  const folder = await createNewArchiveFolder(destination, archiveName);
  let saved = 0;
  const failures = [];
  for (const [position, item] of selected.entries()) {
    const name = item.parts.at(-1);
    let directory = folder;
    let writable;
    try {
      for (const part of item.parts.slice(0, -1))
        directory = await directory.getDirectoryHandle(part, { create: true });
      const handle = await directory.getFileHandle(name, { create: true });
      writable = await handle.createWritable();
      await item.entry.getData(writable, {
        onprogress: (bytes, total) => onprogress(position, selected.length, name, bytes, total)
      });
      saved++;
      onprogress(position, selected.length, name, 1, 1);
    } catch (error) {
      failures.push(`${name}: ${error.message}`);
      await writable?.abort?.().catch(() => {});
      if (directory.removeEntry) await directory.removeEntry(name).catch(() => {});
    }
  }
  return { folderName: folder.name, saved, failures };
}

const fileInput = typeof document === "undefined" ? null : document.getElementById("workspace-zip");
if (fileInput) {
  const summary = document.getElementById("workspace-archive-summary");
  const button = document.getElementById("workspace-extract-btn");
  const output = document.getElementById("workspace-archive-out");
  const label = (ru, en) => document.documentElement.lang === "ru" ? ru : en;
  const formatSize = (bytes) => bytes < 1024 * 1024
    ? `${Math.round(bytes / 1024)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  let reader = null;
  let selected = [];
  let archiveName = "Suno Workspace";

  if (!globalThis.zip?.ZipReader || !globalThis.zip?.BlobReader) {
    output.textContent = label("Модуль ZIP не загрузился. Обновите страницу.", "ZIP module did not load. Refresh the page.");
  } else {
    globalThis.zip.configure({ useWebWorkers: false });
  }

  fileInput.addEventListener("change", async () => {
    button.disabled = true;
    selected = [];
    summary.textContent = "";
    output.textContent = "";
    if (reader) { await reader.close().catch(() => {}); reader = null; }
    const file = fileInput.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".zip")) {
      output.textContent = label("Выберите ZIP, скачанный из Suno.", "Select a ZIP downloaded from Suno.");
      return;
    }
    if (!globalThis.zip?.ZipReader) return;
    output.textContent = label("Читаю список файлов в ZIP…", "Reading the ZIP file list…");
    try {
      reader = new globalThis.zip.ZipReader(new globalThis.zip.BlobReader(file), { useWebWorkers: false });
      const entries = await reader.getEntries();
      selected = listAudioEntries(entries);
      archiveName = safeArchivePath(file.name.replace(/\.zip$/i, ""))?.at(-1) || "Suno Workspace";
      const totalBytes = selected.reduce((sum, item) => sum + (Number(item.entry.uncompressedSize) || 0), 0);
      const skipped = entries.filter((entry) => !entry.directory).length - selected.length;
      summary.textContent = label(
        `Аудиофайлов: ${selected.length} · объём: ${formatSize(totalBytes)}${skipped ? ` · прочих/пропущенных: ${skipped}` : ""}`,
        `Audio files: ${selected.length} · size: ${formatSize(totalBytes)}${skipped ? ` · other/skipped: ${skipped}` : ""}`
      );
      output.textContent = selected.length ? "" : label("В архиве нет аудиофайлов.", "No audio files found in the archive.");
      button.disabled = !selected.length;
    } catch (error) {
      output.textContent = label(`Не удалось открыть ZIP: ${error.message}`, `Could not open ZIP: ${error.message}`);
      if (reader) { await reader.close().catch(() => {}); reader = null; }
    }
  });

  button.addEventListener("click", async () => {
    if (!selected.length || !reader) return;
    if (typeof window.showDirectoryPicker !== "function") {
      output.textContent = label(
        "Выбор папки не поддерживается этим браузером. Откройте сайт в актуальном Brave, Chrome или Edge.",
        "This browser cannot choose a folder. Open the site in a current Brave, Chrome, or Edge."
      );
      return;
    }
    let destination;
    try {
      // A browser grants access only to the folder the user explicitly picks.
      destination = await window.showDirectoryPicker({ mode: "readwrite" });
    } catch (error) {
      if (error.name !== "AbortError") output.textContent = error.message;
      return;
    }
    button.disabled = true;
    fileInput.disabled = true;
    try {
      let lastUpdate = 0;
      const result = await extractSelectedEntries(selected, destination, archiveName, (position, count, name, bytes, total) => {
        if (Date.now() - lastUpdate < 150 && bytes !== total) return;
        lastUpdate = Date.now();
        output.textContent = `${position + 1}/${count} · ${name} · ${total ? Math.round(bytes / total * 100) : 0}%`;
      });
      output.textContent = label(
        `Готово: сохранено ${result.saved} из ${selected.length} в папку «${result.folderName}» в выбранном каталоге.${result.failures.length ? ` Ошибок: ${result.failures.length}. ${result.failures.slice(0, 3).join("; ")}` : ""}`,
        `Done: saved ${result.saved} of ${selected.length} to “${result.folderName}” in the selected folder.${result.failures.length ? ` Errors: ${result.failures.length}. ${result.failures.slice(0, 3).join("; ")}` : ""}`
      );
    } catch (error) {
      output.textContent = label(`Не удалось сохранить файлы: ${error.message}`, `Could not save files: ${error.message}`);
    } finally {
      fileInput.disabled = false;
      await reader?.close().catch(() => {});
      reader = null;
      selected = [];
      fileInput.value = "";
      button.disabled = true;
    }
  });
}

async function createNewArchiveFolder(parent, proposedName) {
  const base = proposedName.replace(/[<>:"|?*\u0000-\u001f]/g, "_").replace(/[. ]+$/g, "").slice(0, 120) || "Suno Workspace";
  for (let i = 1; i <= 999; i++) {
    const name = i === 1 ? base : `${base} (${i})`;
    try {
      await parent.getDirectoryHandle(name);
    } catch (error) {
      if (error.name !== "NotFoundError" && error.name !== "TypeMismatchError") throw error;
      return parent.getDirectoryHandle(name, { create: true });
    }
  }
  throw new Error("Could not allocate a new folder");
}
