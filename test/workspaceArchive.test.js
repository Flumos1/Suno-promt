import test from "node:test";
import assert from "node:assert/strict";
import * as zip from "@zip.js/zip.js";
import { safeArchivePath, listAudioEntries, extractSelectedEntries } from "../public/workspace-archive.js";

test("ZIP paths cannot escape the chosen folder", () => {
  assert.equal(safeArchivePath("../outside.mp3"), null);
  assert.equal(safeArchivePath("C:\\outside.mp3"), null);
  assert.equal(safeArchivePath("/outside.mp3"), null);
  assert.deepEqual(safeArchivePath("Моя папка\\Песня: ночь.mp3"), ["Моя папка", "Песня_ ночь.mp3"]);
  const entries = listAudioEntries([
    { filename: "set/song.mp3" }, { filename: "set/SONG.mp3" },
    { filename: "../outside.mp3" }, { filename: "set/link.mp3", symlink: true }
  ]);
  assert.deepEqual(entries.map((item) => item.parts.join("/")), ["set/song.mp3", "set/SONG (2).mp3"]);
});

test("Suno archive extracts only audio into a new folder with distinct names", async () => {
  zip.configure({ useWebWorkers: false });
  const writer = new zip.ZipWriter(new zip.BlobWriter("application/zip"));
  await writer.add("Песни/Моя песня.mp3", new zip.TextReader("audio-one"));
  await writer.add("Песни/Моя песня.wav", new zip.TextReader("audio-two"));
  await writer.add("notes.txt", new zip.TextReader("not a song"));
  const blob = await writer.close();
  const reader = new zip.ZipReader(new zip.BlobReader(blob), { useWebWorkers: false });
  const selected = listAudioEntries(await reader.getEntries());
  assert.equal(selected.length, 2);
  const root = memoryDirectory("Downloads");
  const result = await extractSelectedEntries(selected, root, "My Suno Workspace");
  assert.equal(result.saved, 2);
  assert.deepEqual(result.failures, []);
  const songs = root.directories.get("My Suno Workspace").directories.get("Песни");
  assert.equal(songs.files.get("Моя песня.mp3").toString(), "audio-one");
  assert.equal(songs.files.get("Моя песня.wav").toString(), "audio-two");
  assert.equal(root.files.size, 0);
  await reader.close();
});

function memoryDirectory(name) {
  return {
    name,
    directories: new Map(),
    files: new Map(),
    async getDirectoryHandle(child, options = {}) {
      if (this.directories.has(child)) return this.directories.get(child);
      if (!options.create) throw Object.assign(new Error("not found"), { name: "NotFoundError" });
      const next = memoryDirectory(child);
      this.directories.set(child, next);
      return next;
    },
    async getFileHandle(child) {
      const parent = this;
      return {
        async createWritable() {
          const chunks = [];
          return new WritableStream({
            write(chunk) { chunks.push(Buffer.from(chunk)); },
            close() { parent.files.set(child, Buffer.concat(chunks)); },
            abort() { chunks.length = 0; }
          });
        }
      };
    },
    async removeEntry(child) { this.files.delete(child); }
  };
}
