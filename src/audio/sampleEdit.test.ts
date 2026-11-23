import { describe, expect, it } from "vitest";
import { NORMALIZED_PEAK, prepareRecording } from "./sampleEdit";

const RATE = 48000;

/** Silence, then a decaying 200 Hz hit of the given peak, then silence. */
function hit({ before = 0.5, peak = 0.3, after = 0.5 } = {}) {
  const lead = Math.round(before * RATE);
  const body = Math.round(0.2 * RATE);
  const out = new Float32Array(lead + body + Math.round(after * RATE));
  for (let i = 0; i < body; i++) out[lead + i] = peak * Math.exp(-i / (0.03 * RATE)) * Math.sin((2 * Math.PI * 200 * i) / RATE + Math.PI / 2);
  return out;
}

const peakOf = (a: Float32Array) => a.reduce((m, v) => Math.max(m, Math.abs(v)), 0);

describe("preparing a recorded sound", () => {
  it("trims the silence before the sound, keeping a 3 ms pre-roll", () => {
    const out = prepareRecording([hit({ before: 0.5 })], RATE)!;
    const firstLoud = out.findIndex((v) => Math.abs(v) > NORMALIZED_PEAK * 0.05);
    expect(firstLoud / RATE).toBeCloseTo(0.003, 3);
  });

  it("trims the silence after it, ending in a fade to zero", () => {
    const out = prepareRecording([hit({ after: 1 })], RATE)!;
    expect(out.length / RATE).toBeLessThan(0.25); // the 0.2 s hit, not 1.7 s
    expect(Math.abs(out[out.length - 1])).toBeLessThan(1e-3);
  });

  it("normalizes quiet and loud recordings to the same peak", () => {
    expect(peakOf(prepareRecording([hit({ peak: 0.02 })], RATE)!)).toBeCloseTo(NORMALIZED_PEAK, 3);
    expect(peakOf(prepareRecording([hit({ peak: 0.9 })], RATE)!)).toBeCloseTo(NORMALIZED_PEAK, 3);
  });

  it("mixes stereo to mono", () => {
    const left = hit();
    const right = new Float32Array(left.length);
    const out = prepareRecording([left, right], RATE)!;
    expect(peakOf(out)).toBeCloseTo(NORMALIZED_PEAK, 3);
  });

  it("returns null for silence or nothing", () => {
    expect(prepareRecording([new Float32Array(RATE)], RATE)).toBeNull();
    expect(prepareRecording([hit({ peak: 0.001 })], RATE)).toBeNull();
    expect(prepareRecording([], RATE)).toBeNull();
  });
});
