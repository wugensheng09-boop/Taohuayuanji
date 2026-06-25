import { mkdir, writeFile } from "node:fs/promises";

const sampleRate = 44100;
const bpm = 72;
const bars = 16;
const beatsPerBar = 4;
const duration = (60 / bpm) * beatsPerBar * bars;
const totalSamples = Math.floor(sampleRate * duration);
const left = new Float32Array(totalSamples);
const right = new Float32Array(totalSamples);

const outPath = "public/audio/taohuayuanji/bgm/ruhua-wenyou-main-theme.wav";

const beat = 60 / bpm;
const bar = beat * beatsPerBar;
const twoPi = Math.PI * 2;

function midiToHz(note) {
  return 440 * 2 ** ((note - 69) / 12);
}

function smoothstep(edge0, edge1, value) {
  const x = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)));
  return x * x * (3 - 2 * x);
}

function addSample(index, value, pan = 0) {
  const angle = (pan + 1) * Math.PI * 0.25;
  left[index] += value * Math.cos(angle);
  right[index] += value * Math.sin(angle);
}

function wrapIndex(sample) {
  let index = sample % totalSamples;
  if (index < 0) index += totalSamples;
  return index;
}

function addPluck(start, freq, amp, pan, decay = 2.2, noteLength = 5.8) {
  const startSample = Math.floor(start * sampleRate);
  const samples = Math.floor(noteLength * sampleRate);
  for (let i = 0; i < samples; i += 1) {
    const t = i / sampleRate;
    const attack = smoothstep(0, 0.018, t);
    const env = attack * Math.exp(-t / decay);
    const shimmer = 1 + 0.018 * Math.sin(twoPi * 0.18 * (start + t));
    const body =
      Math.sin(twoPi * freq * t) * 0.72 +
      Math.sin(twoPi * freq * 2.01 * t + 0.15) * 0.2 +
      Math.sin(twoPi * freq * 3.02 * t + 0.7) * 0.08;
    const thumb = Math.sin(twoPi * freq * 0.5 * t) * Math.exp(-t / 0.65) * 0.12;
    addSample(wrapIndex(startSample + i), (body + thumb) * env * amp * shimmer, pan);
  }
}

function addPad(start, freq, length, amp, pan, attack = 1.8, release = 2.2) {
  const startSample = Math.floor(start * sampleRate);
  const samples = Math.floor(length * sampleRate);
  for (let i = 0; i < samples; i += 1) {
    const t = i / sampleRate;
    const envIn = smoothstep(0, attack, t);
    const envOut = 1 - smoothstep(length - release, length, t);
    const env = envIn * envOut;
    const vib = 1 + 0.0025 * Math.sin(twoPi * 4.8 * t);
    const tone =
      Math.sin(twoPi * freq * vib * t) * 0.56 +
      Math.sin(twoPi * freq * 2 * vib * t + 1.2) * 0.12 +
      Math.sin(twoPi * freq * 0.5 * t + 0.4) * 0.18;
    addSample(wrapIndex(startSample + i), tone * env * amp, pan);
  }
}

function addBreathLayer() {
  const partials = [
    [0.061, 0.024, -0.8],
    [0.073, 0.019, 0.7],
    [0.091, 0.016, -0.25],
    [0.113, 0.014, 0.35],
    [0.137, 0.012, 0.05],
  ];
  for (let i = 0; i < totalSamples; i += 1) {
    const t = i / sampleRate;
    let value = 0;
    for (const [freq, amp, phase] of partials) {
      value += Math.sin(twoPi * freq * t + phase) * amp;
    }
    const slowGate = 0.65 + 0.35 * Math.sin(twoPi * (1 / duration) * t - Math.PI / 2);
    addSample(i, value * slowGate, 0);
  }
}

function addBell(start, freq, amp, pan) {
  const startSample = Math.floor(start * sampleRate);
  const samples = Math.floor(4.8 * sampleRate);
  for (let i = 0; i < samples; i += 1) {
    const t = i / sampleRate;
    const env = Math.exp(-t / 1.85) * smoothstep(0, 0.01, t);
    const tone =
      Math.sin(twoPi * freq * t) * 0.5 +
      Math.sin(twoPi * freq * 2.42 * t + 0.8) * 0.22 +
      Math.sin(twoPi * freq * 3.02 * t + 1.7) * 0.11;
    addSample(wrapIndex(startSample + i), tone * env * amp, pan);
  }
}

function softLimit(value) {
  return Math.tanh(value * 1.15) * 0.88;
}

function renderTheme() {
  addBreathLayer();

  const roots = [50, 57, 59, 54, 50, 57, 62, 57, 50, 59, 57, 54, 50, 57, 59, 50];
  for (let b = 0; b < bars; b += 1) {
    const root = roots[b];
    const start = b * bar;
    addPad(start, midiToHz(root - 12), bar + 0.12, 0.032, -0.36, 0.6, 1.1);
    addPad(start, midiToHz(root), bar + 0.12, 0.02, 0.38, 0.8, 1.3);

    const pattern = [
      [0, root, 0.09, -0.28],
      [1.15, root + 7, 0.054, 0.25],
      [2.05, root + 12, 0.045, -0.08],
      [3.04, root + 4, 0.038, 0.46],
    ];
    for (const [offsetBeats, note, amp, pan] of pattern) {
      addPluck(start + offsetBeats * beat, midiToHz(note), amp, pan);
    }
  }

  const melody = [
    [0.5, 69, 2.8, 0.038, 0.22],
    [2.5, 66, 3.1, 0.034, 0.28],
    [4.5, 64, 2.8, 0.032, 0.18],
    [6.5, 62, 3.2, 0.036, 0.26],
    [8.5, 71, 2.5, 0.034, -0.2],
    [10.5, 69, 3.4, 0.033, -0.14],
    [12.5, 66, 2.8, 0.034, 0.18],
    [14.5, 62, 3.4, 0.038, 0.12],
  ];
  for (const [barPos, note, lenBeats, amp, pan] of melody) {
    addPad(barPos * bar, midiToHz(note), lenBeats * beat, amp, pan, 0.55, 1.2);
  }

  const bells = [
    [1.75, 81, 0.026, 0.72],
    [5.75, 78, 0.023, -0.64],
    [9.75, 83, 0.024, 0.6],
    [13.75, 81, 0.025, -0.45],
  ];
  for (const [barPos, note, amp, pan] of bells) {
    addBell(barPos * bar, midiToHz(note), amp, pan);
  }

  const edgeFade = Math.floor(0.018 * sampleRate);
  for (let i = 0; i < edgeFade; i += 1) {
    const fade = smoothstep(0, edgeFade, i);
    left[i] *= fade;
    right[i] *= fade;
  }

  let peak = 0;
  for (let i = 0; i < totalSamples; i += 1) {
    left[i] = softLimit(left[i]);
    right[i] = softLimit(right[i]);
    peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
  }
  const gain = peak > 0 ? 0.92 / peak : 1;
  for (let i = 0; i < totalSamples; i += 1) {
    left[i] *= gain;
    right[i] *= gain;
  }
}

function writeString(view, offset, string) {
  for (let i = 0; i < string.length; i += 1) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

function makeWav() {
  const channels = 2;
  const bytesPerSample = 2;
  const dataSize = totalSamples * channels * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channels * bytesPerSample, true);
  view.setUint16(32, channels * bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, "data");
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < totalSamples; i += 1) {
    const l = Math.max(-1, Math.min(1, left[i]));
    const r = Math.max(-1, Math.min(1, right[i]));
    view.setInt16(offset, l < 0 ? l * 0x8000 : l * 0x7fff, true);
    view.setInt16(offset + 2, r < 0 ? r * 0x8000 : r * 0x7fff, true);
    offset += 4;
  }
  return Buffer.from(buffer);
}

renderTheme();
await mkdir("public/audio/taohuayuanji/bgm", { recursive: true });
await writeFile(outPath, makeWav());

console.log(JSON.stringify({ outPath, seconds: Number(duration.toFixed(3)), sampleRate, bpm, bars }, null, 2));
