import { describe, expect, it } from "vitest";
import { NORMALIZED_PEAK, fft, lowCut, prepareRecording, reduceNoise } from "./sampleEdit";

const RATE = 48000;
const secs = (s: number) => Math.round(s * RATE);

/** A decaying 200 Hz hit of the given peak, starting at `at` seconds, in a buffer `total` seconds long. */
function hit({ at = 0.5, peak = 0.3, total = 1.2 } = {}) {
  const out = new Float32Array(secs(total));
  const start = secs(at);
  for (let i = 0; start + i < out.length && i < secs(0.4); i++)
    out[start + i] = peak * Math.exp(-i / secs(0.03)) * Math.sin((2 * Math.PI * 200 * i) / RATE + Math.PI / 2);
  return out;
}

/** Steady white noise at the given RMS, from a fixed seed so every run is the same. */
function noise(length: number, rms: number, seed = 1) {
  let state = seed;
  const random = () => ((state = (state * 1664525 + 1013904223) >>> 0) / 2 ** 32) * 2 - 1;
  return Float32Array.from({ length }, () => random() * rms * Math.sqrt(3)); // uniform: rms = amplitude / sqrt(3)
}

const add = (a: Float32Array, b: Float32Array) => a.map((v, i) => v + b[i]);
const tone = (hz: number, length = RATE) => Float32Array.from({ length }, (_, i) => Math.sin((2 * Math.PI * hz * i) / RATE));
const rmsOf = (a: Float32Array, from = 0, to = a.length) => Math.sqrt(a.subarray(from, to).reduce((s, v) => s + v * v, 0) / (to - from));
const peakOf = (a: Float32Array) => a.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
const db = (ratio: number) => 20 * Math.log10(ratio);

describe("preparing a recorded sound", () => {
  it("trims the silence before the sound, keeping a 3 ms pre-roll", () => {
    const out = prepareRecording([hit({ at: 0.5 })], RATE)!;
    const firstLoud = out.findIndex((v) => Math.abs(v) > NORMALIZED_PEAK * 0.05);
    expect(firstLoud / RATE).toBeCloseTo(0.003, 3);
  });

  it("trims the silence after it, ending in a fade to zero", () => {
    const out = prepareRecording([hit({ total: 2 })], RATE)!;
    expect(out.length / RATE).toBeLessThan(0.45); // the 0.4 s hit (plus fade), not 1.5 s
    expect(Math.abs(out[out.length - 1])).toBeLessThan(1e-3);
  });

  it("normalizes quiet and loud recordings to the same peak", () => {
    expect(peakOf(prepareRecording([hit({ peak: 0.02 })], RATE)!)).toBeCloseTo(NORMALIZED_PEAK, 3);
    expect(peakOf(prepareRecording([hit({ peak: 0.9 })], RATE)!)).toBeCloseTo(NORMALIZED_PEAK, 3);
  });

  it("mixes stereo to mono", () => {
    const left = hit();
    const out = prepareRecording([left, new Float32Array(left.length)], RATE)!;
    expect(peakOf(out)).toBeCloseTo(NORMALIZED_PEAK, 3);
  });

  it("returns null for silence or nothing", () => {
    expect(prepareRecording([new Float32Array(RATE)], RATE)).toBeNull();
    expect(prepareRecording([hit({ peak: 0.001 })], RATE)).toBeNull();
    expect(prepareRecording([], RATE)).toBeNull();
  });

  it("gates the tail: a noisy recording ends where the hit sinks into the noise, not at the end", () => {
    const noisy = add(hit({ total: 2.5 }), noise(secs(2.5), 0.003));
    const out = prepareRecording([noisy], RATE)!;
    expect(out.length / RATE).toBeLessThan(0.4); // the hit decays into the noise well within 0.4 s
    expect(out.length / RATE).toBeGreaterThan(0.1);
  });

  it("removes most of the background noise from what's kept", () => {
    const clean = prepareRecording([hit()], RATE)!;
    const out = prepareRecording([add(hit(), noise(secs(1.2), 0.003))], RATE)!;
    // Compare the kept sound with the same hit recorded without noise: what's left is the noise.
    const n = Math.min(clean.length, out.length);
    const leftover = out.subarray(0, n).map((v, i) => v - clean[i]);
    const noiseBefore = (0.003 / 0.3) * NORMALIZED_PEAK; // the input noise, at the output's level
    expect(db(rmsOf(leftover) / noiseBefore)).toBeLessThan(-6);
  });
});

describe("low-cut filter", () => {
  it("cuts rumble below 40 Hz and leaves the rest", () => {
    const level = (hz: number) => db(rmsOf(lowCut(tone(hz), RATE, 40), RATE / 2) / Math.SQRT1_2);
    expect(level(15)).toBeLessThan(-15);
    expect(level(40)).toBeCloseTo(-3, 0); // the corner
    expect(level(60)).toBeGreaterThan(-1.5); // a kick's body
    expect(Math.abs(level(200))).toBeLessThan(0.2);
  });
});

describe("noise reduction", () => {
  it("leaves a recording with silent lead-in unchanged", () => {
    const x = hit();
    const y = reduceNoise(x, secs(0.45))!;
    expect(Math.max(...x.map((v, i) => Math.abs(v - y[i])))).toBeLessThan(1e-4);
  });

  it("turns steady noise down by more than 15 dB", () => {
    const x = noise(secs(1), 0.01);
    const y = reduceNoise(x, secs(0.3))!;
    expect(db(rmsOf(y, secs(0.4), secs(0.9)) / 0.01)).toBeLessThan(-15);
  });

  it("keeps a hit that stands well above the noise", () => {
    const x = add(hit(), noise(secs(1.2), 0.003));
    const y = reduceNoise(x, secs(0.45))!;
    const during = [secs(0.5), secs(0.56)] as const; // the first 60 ms of the hit
    expect(db(rmsOf(y, ...during) / rmsOf(hit(), ...during))).toBeGreaterThan(-1);
  });

  it("is skipped when the sound starts too soon to learn the noise", () => {
    expect(reduceNoise(hit({ at: 0.01 }), secs(0.005))).toBeNull();
  });
});

describe("FFT", () => {
  it("finds a tone's frequency and round-trips", () => {
    const re = Float64Array.from({ length: 64 }, (_, i) => Math.cos((2 * Math.PI * 5 * i) / 64));
    const im = new Float64Array(64);
    const original = re.slice();
    fft(re, im);
    const mags = Array.from(re, (r, k) => Math.hypot(r, im[k]));
    expect(mags.indexOf(Math.max(...mags.slice(0, 32)))).toBe(5);
    for (let i = 0; i < 64; i++) im[i] = -im[i];
    fft(re, im);
    re.forEach((v, i) => expect(v / 64).toBeCloseTo(original[i], 9));
  });
});
