import test from "node:test";
import assert from "node:assert/strict";
import { makeAudioSample, analyzeSound, refineSunoPrompt } from "../lib/sonicAnalysis.js";

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
