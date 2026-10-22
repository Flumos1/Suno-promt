import test from "node:test";
import assert from "node:assert/strict";
import { makeAudioSample, analyzeSound, refineSunoPrompt, makeFormSample, measureFormSignal, analyzeFormAudio, composeInstrumentalForm } from "../lib/sonicAnalysis.js";

function sineWav(seconds = 2) {
  const rate = 16000;
  const samples = rate * seconds;
  const out = Buffer.alloc(44 + samples * 2);
  out.write("RIFF", 0);
  out.writeUInt32LE(out.length - 8, 4);
  out.write("WAVEfmt ", 8);
  out.writeUInt32LE(16, 16);
  out.writeUInt16LE(1, 20);
  out.writeUInt16LE(1, 22);
  out.writeUInt32LE(rate, 24);
  out.writeUInt32LE(rate * 2, 28);
  out.writeUInt16LE(2, 32);
  out.writeUInt16LE(16, 34);
  out.write("data", 36);
  out.writeUInt32LE(samples * 2, 40);
  for (let i = 0; i < samples; i++)
    out.writeInt16LE(Math.round(Math.sin(2 * Math.PI * 440 * i / rate) * 5000), 44 + i * 2);
  return out;
}

test("deep analysis decodes actual audio and sends an audio input", async () => {
  const sampled = await makeAudioSample(sineWav(), 2);
  assert.ok(sampled.audio.length > 1000);
  assert.deepEqual(sampled.starts, [0]);
  const previousKey = process.env.OPENAI_API_KEY;
  const previousFetch = globalThis.fetch;
  process.env.OPENAI_API_KEY = "test-key";
  let request;
  globalThis.fetch = async (_, options) => {
    request = JSON.parse(options.body);
    return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({ summary: "Тон", suno_prompt: "Sparse sine tone, no drums or vocals." }) } }] }) };
  };
  try {
    const result = await analyzeSound(sampled.audio, { ...sampled, durationSec: 2 });
    assert.equal(result.summary, "Тон");
    assert.equal(request.model, "gpt-audio-1.5");
    assert.equal(request.messages[1].content[1].type, "input_audio");
    assert.equal(request.messages[1].content[1].input_audio.format, "mp3");
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousKey;
  }
});

test("long tracks are sampled at beginning, middle and end", async () => {
  const sampled = await makeAudioSample(sineWav(90), 90);
  assert.deepEqual(sampled.starts, [0, 35, 70]);
  assert.equal(sampled.sampleSeconds, 60);
  assert.ok(sampled.audio.length < 1024 * 1024);
});

test("prompt editing falls back to the listening draft when the text model fails", async () => {
  const previousKey = process.env.OPENAI_API_KEY;
  const previousFetch = globalThis.fetch;
  process.env.OPENAI_API_KEY = "test-key";
  globalThis.fetch = async () => ({ ok: false });
  try {
    assert.equal(await refineSunoPrompt({ suno_prompt: "Audible soft synth chord and slow beat." }),
      "Audible soft synth chord and slow beat.");
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousKey;
  }
});

test("form sample covers the track with audible gaps between excerpts", async () => {
  const sampled = await makeFormSample(sineWav(32), 32);
  assert.deepEqual(sampled.starts, [0, 8, 16, 24]);
  assert.equal(sampled.sampleSeconds, 32);
  assert.equal(sampled.coveragePercent, 100);
  assert.ok(sampled.audio.length > 1000);
  assert.ok(sampled.audio.length < 1024 * 1024);
  const signal = await measureFormSignal(sampled.audio, sampled);
  assert.equal(signal.stationary, true);
});

test("form signal check keeps audible rhythmic changes eligible for analysis", async () => {
  const wav = sineWav(24);
  for (let i = 0; i < 16000 * 24; i++) {
    const gate = Math.floor(i / 4000) % 2 === 0 ? 1 : 0.08;
    wav.writeInt16LE(Math.round(wav.readInt16LE(44 + i * 2) * gate), 44 + i * 2);
  }
  const sampled = await makeFormSample(wav, 24);
  const signal = await measureFormSignal(sampled.audio, sampled);
  assert.equal(signal.stationary, false);
});

test("form signal check recognizes silence before paid audio analysis", async () => {
  const wav = sineWav(24);
  wav.fill(0, 44);
  const sampled = await makeFormSample(wav, 24);
  const signal = await measureFormSignal(sampled.audio, sampled);
  assert.equal(signal.silent, true);
});

test("form analysis produces time-anchored, bracket-only instrumental markup", async () => {
  const previousKey = process.env.OPENAI_API_KEY;
  const previousFetch = globalThis.fetch;
  process.env.OPENAI_API_KEY = "test-key";
  let calls = 0;
  globalThis.fetch = async (_, options) => {
    calls++;
    const request = JSON.parse(options.body);
    if (calls === 1) {
      assert.equal(request.messages[1].content[1].type, "input_audio");
      return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({
        observations: [{ index: 1, heard: "tone A" }, { index: 2, heard: "tone B" }, { index: 3, heard: "tone A" }],
        overall_form: "A–B–A", recurring_motifs: ["tone A"]
      }) } }] }) };
    }
    return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({
      summary: "Возвращается первая тема",
      sections: [{ startSec: 1, endSec: 12, label: "Тема", confidence: "medium" },
        { startSec: 13, endSec: 24, label: "Контраст", confidence: "medium" }],
      instrumentalMarkup: "[Intro: single lead tone]\nA sung lyric line\n[Bridge: contrasting tone]\n[Chorus: first tone returns]"
    }) } }] }) };
  };
  try {
    const context = { starts: [0, 10, 20], clipSeconds: 8, gapSeconds: 0.65, durationSec: 30 };
    const heard = await analyzeFormAudio(Buffer.from("fake-mp3"), context);
    const composed = await composeInstrumentalForm(heard, context);
    assert.equal(composed.summary, "Возвращается первая тема");
    assert.equal(composed.sections[0].startSec, 0);
    assert.equal(composed.sections[0].endSec, 10);
    assert.equal(composed.markup.split("\n").length, 3);
    assert.ok(!composed.markup.includes("A sung lyric line"));
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousKey;
  }
});
