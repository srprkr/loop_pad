import { describe, expect, it } from "vitest";
import { LIMITER_CEILING, limitBlock, limiterTiming, newLimiterState } from "./limiter";

const RATE = 48000;
const timing = limiterTiming(RATE);

/** Runs one channel through a fresh limiter. */
function limit(samples: number[]) {
  const input = [Float32Array.from(samples)];
  const output = [new Float32Array(samples.length)];
  const state = newLimiterState();
  limitBlock(input, output, state, timing);
  return { out: Array.from(output[0]), state };
}

const sine = (amplitude: number, n: number, hz = 60) =>
  Array.from({ length: n }, (_, i) => amplitude * Math.sin((2 * Math.PI * hz * i) / RATE));

describe("limiter", () => {
  it("passes sound below the ceiling through unchanged", () => {
    const input = sine(0.8, 4800);
    const { out } = limit(input);
    out.forEach((v, i) => expect(v).toBeCloseTo(input[i], 6));
  });

  it("never lets a sample over the ceiling (-1 dBFS)", () => {
    const { out } = limit(sine(1.6, 4800));
    expect(Math.max(...out.map(Math.abs))).toBeLessThanOrEqual(LIMITER_CEILING + 1e-6);
  });

  it("holds the gain down between peaks rather than clipping each one", () => {
    // After the first loud peak, the next cycles are scaled as a whole by one gain, so they keep
    // their sine shape; a clipper would flatten every peak.
    const input = sine(1.6, 4800);
    const { out } = limit(input);
    const gains = [];
    for (let i = 800; i < 4800; i++) if (Math.abs(input[i]) > 0.05) gains.push(out[i] / input[i]); // 60 Hz: 800 samples per cycle
    expect(Math.max(...gains) - Math.min(...gains)).toBeLessThan(1e-6);
    expect(gains[0]).toBeCloseTo(LIMITER_CEILING / 1.6, 3);
  });

  it("recovers to full gain after a loud hit", () => {
    const { out } = limit([...sine(1.6, 2400), ...Array(RATE).fill(0), ...sine(0.5, 2400)]);
    const after = out.slice(-2400);
    const peak = Math.max(...after.map(Math.abs));
    expect(peak).toBeGreaterThan(0.49); // back to unity: the quiet sound isn't turned down
  });

  it("applies one gain to all channels", () => {
    const left = Float32Array.from(sine(1.6, 2400));
    const right = Float32Array.from(sine(0.4, 2400));
    const out = [new Float32Array(2400), new Float32Array(2400)];
    limitBlock([left, right], out, newLimiterState(), timing);
    for (let i = 1; i < 2400; i += 97) {
      if (Math.abs(left[i]) > 1e-3) expect(out[1][i] / right[i]).toBeCloseTo(out[0][i] / left[i], 5);
    }
  });

  it("outputs silence when nothing is connected", () => {
    const output = [new Float32Array(128)];
    limitBlock([], output, newLimiterState(), timing);
    expect(output[0].every((v) => v === 0)).toBe(true);
  });
});
