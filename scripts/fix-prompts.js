// One-time script: strip key/tonality and "fits a X" from all artist prompts
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const filePath = path.join(__dirname, "../data/artists.json");
const artists = JSON.parse(fs.readFileSync(filePath, "utf8"));

let count = 0;
for (const a of artists) {
  let p = a.prompt;

  // Remove ", fits a ..." anywhere in the string
  p = p.replace(/,\s*fits a [^,]+/g, "");

  // Remove the exact key value at the end
  if (a.key) {
    const escaped = a.key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    p = p.replace(new RegExp(",\\s*" + escaped + "\\s*$", "i"), "");
  }

  // Fallback key patterns at end
  p = p.replace(/,\s*[A-G][b#]?\s*(major|minor)\s*$/i, "");
  p = p.replace(/,\s*[A-G]-flat\s*(major|minor)\s*$/i, "");
  p = p.replace(/,\s*B-flat\s*(major|minor)\s*$/i, "");
  p = p.replace(/,\s*modal\s*$/i, "");
  p = p.replace(/,\s*Maqam\s+\w+\s*$/i, "");

  // Clean trailing comma/space
  p = p.trim().replace(/,\s*$/, "");

  if (p !== a.prompt) {
    a.prompt = p;
    count++;
  }
}

fs.writeFileSync(filePath, JSON.stringify(artists, null, 2));
console.log(`Updated ${count} / ${artists.length} prompts`);

// Show a few samples
const samples = ["en-2pac", "en-abba", "en-ac-dc", "ru-аквариум", "ru-oxxxymiron"];
samples.forEach((id) => {
  const a = artists.find((x) => x.id === id);
  if (a) console.log(`\n[${a.name}]\n${a.prompt}`);
});
