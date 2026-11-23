// Turns a raw microphone recording into a pad sound. Pure, so it can be unit-tested.
//
//   1. Mixed to mono.
//   2. Low-cut filter: removes rumble and hum below ~40 Hz.
//   3. Noise reduction: the moment of silence before the sound is the room's noise on its own,
//      so its spectrum is learned from there and subtracted from the whole recording. Kept
//      moderate (at most -20 dB per frequency), which avoids the watery "musical noise" that
//      heavier settings leave. Skipped if the sound starts too soon to learn from.
//   4. Trimmed to the sound: it starts the moment you made it (so the pad plays at once), and the
//      tail is gated: it fades out once it decays to near the remaining noise, instead of
//      ringing out into hiss.
//   5. Normalized, so a quiet recording isn't buried under the kit.

/** Longest recording, in seconds. Pad sounds are short; this also keeps the stored audio small. */
export const MAX_RECORDING_SEC = 3;

/** The peak level after normalizing: -3 dBFS, leaving headroom for pad volumes above 100%. */
export const NORMALIZED_PEAK = 10 ** (-3 / 20);
/** A recording whose peak is below this (-46 dBFS) is treated as silence. */
export const SILENCE_PEAK = 0.005;

/** Low-cut corner frequency. Low enough to keep a kick's body (around 50-60 Hz). */
export const LOW_CUT_HZ = 40;

/** The sound starts where it first reaches this fraction of its peak... */
const START_THRESHOLD = 0.05;
/** ...minus this much, so the attack isn't clipped. */
const PRE_ROLL_SEC = 0.003;
/** The noise is learned from the silence before the sound, up to this long before it starts. */
const NOISE_GUARD_SEC = 0.01;

// Noise reduction (spectral subtraction).
const FFT_SIZE = 1024; // ~21 ms at 48 kHz
const HOP = FFT_SIZE / 4;
/** Frames of silence needed to learn the noise (~37 ms at 48 kHz). */
const MIN_NOISE_FRAMES = 4;
/** Subtract this many times the noise's average power: noise momentarily peaks well above its average, and
    those peaks would otherwise poke through. Measured: steady noise -17 dB, a hit's attack untouched. */
const OVER_SUBTRACTION = 4;
/** Never turn a frequency down by more than this (-20 dB). */
const MAX_REDUCTION = 0.1;

// Tail gate.
const ENVELOPE_SEC = 0.005;
/** The tail ends where it last rises this far above the remaining noise (+6 dB)... */
const GATE_ABOVE_NOISE = 2;
/** ...but never lower than this fraction of the peak (-60 dB), in case the silence was perfect... */
const GATE_FLOOR = 0.001;
/** ...or, with no noise measured, where it last reaches this fraction of its peak (-40 dB). */
const END_THRESHOLD = 0.01;
const FADE_OUT_SEC = 0.02;

/** Mono, cleaned, trimmed and normalized samples, or null if the recording was silent. */
export function prepareRecording(channels: Float32Array[], sampleRate: number): Float32Array | null {
  if (channels.length === 0 || channels[0].length === 0) return null;

  const length = channels[0].length;
  const mono = new Float32Array(length);
  for (const channel of channels) for (let i = 0; i < length; i++) mono[i] += channel[i] / channels.length;

  const filtered = lowCut(mono, sampleRate, LOW_CUT_HZ);
  const rawPeak = peakOf(filtered);
  if (rawPeak < SILENCE_PEAK) return null;

  // Where the sound starts; the silence before it is the noise on its own.
  let first = 0;
  while (first < length && Math.abs(filtered[first]) < rawPeak * START_THRESHOLD) first++;
  const noiseEnd = first - Math.round((PRE_ROLL_SEC + NOISE_GUARD_SEC) * sampleRate);

  const cleaned = reduceNoise(filtered, noiseEnd) ?? filtered;
  const peak = peakOf(cleaned);
  if (peak < SILENCE_PEAK) return null;

  // Trim: from just before the sound starts to where the tail sinks into the noise.
  const start = Math.max(0, first - Math.round(PRE_ROLL_SEC * sampleRate));
  const end = Math.min(length, tailEnd(cleaned, first, noiseEnd, peak, sampleRate) + Math.round(FADE_OUT_SEC * sampleRate));
  const out = cleaned.slice(start, end);

  // Normalize, and fade out the tail so it doesn't end with a click.
  const gain = NORMALIZED_PEAK / peak;
  const fadeStart = Math.max(0, out.length - Math.round(FADE_OUT_SEC * sampleRate));
  for (let i = 0; i < out.length; i++) {
    const fadeGain = i < fadeStart ? 1 : (out.length - i) / (out.length - fadeStart);
    out[i] *= gain * fadeGain;
  }
  return out;
}

const peakOf = (x: Float32Array) => x.reduce((m, v) => Math.max(m, Math.abs(v)), 0);

/** A 12 dB/octave high-pass (Butterworth biquad) at `hz`. */
export function lowCut(x: Float32Array, sampleRate: number, hz: number): Float32Array {
  const w = (2 * Math.PI * hz) / sampleRate;
  const alpha = Math.sin(w) / (2 * Math.SQRT1_2);
  const cos = Math.cos(w);
  const a0 = 1 + alpha;
  const b0 = (1 + cos) / 2 / a0;
  const b1 = -(1 + cos) / a0;
  const b2 = b0;
  const a1 = (-2 * cos) / a0;
  const a2 = (1 - alpha) / a0;

  const y = new Float32Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const out = b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1;
    x1 = x[i];
    y2 = y1;
    y1 = out;
    y[i] = out;
  }
  return y;
}

/**
 * Spectral subtraction: learns the noise's spectrum from x[0 .. noiseEnd) and turns each frequency
 * down by how much of it is noise, frame by frame. Null if there isn't enough silence to learn from.
 */
export function reduceNoise(x: Float32Array, noiseEnd: number): Float32Array | null {
  const N = FFT_SIZE;
  if (noiseEnd < N + (MIN_NOISE_FRAMES - 1) * HOP) return null;

  // sqrt-Hann on analysis and synthesis: their product is a Hann window, which sums to 2 at 75% overlap.
  const window = new Float64Array(N);
  for (let i = 0; i < N; i++) window[i] = Math.sqrt(0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N));

  // Padded by a frame each side, so every sample is covered by full overlap.
  const padded = new Float64Array(x.length + 2 * N);
  padded.set(x, N);
  const out = new Float64Array(padded.length);
  const bins = N / 2 + 1;
  const re = new Float64Array(N);
  const im = new Float64Array(N);

  const analyse = (offset: number) => {
    for (let i = 0; i < N; i++) {
      re[i] = padded[offset + i] * window[i];
      im[i] = 0;
    }
    fft(re, im);
  };

  // Learn the noise: average power per frequency over frames entirely within the silence.
  const noise = new Float64Array(bins);
  let frames = 0;
  for (let offset = N; offset + N <= N + noiseEnd; offset += HOP, frames++) {
    analyse(offset);
    for (let k = 0; k < bins; k++) noise[k] += re[k] * re[k] + im[k] * im[k];
  }
  for (let k = 0; k < bins; k++) noise[k] /= frames;

  const gains = new Float64Array(bins);
  const previous = new Float64Array(bins).fill(1);
  for (let offset = 0; offset + N <= padded.length; offset += HOP) {
    analyse(offset);
    for (let k = 0; k < bins; k++) {
      const power = re[k] * re[k] + im[k] * im[k];
      const g = power > 0 ? Math.sqrt(Math.max(0, 1 - (OVER_SUBTRACTION * noise[k]) / power)) : 0;
      gains[k] = Math.max(MAX_REDUCTION, g);
    }
    // Smooth across neighbouring frequencies, and let gains fall gradually over time (rise at
    // once, so attacks pass): both stop isolated bins flickering, the source of "musical noise".
    for (let k = 0; k < bins; k++) {
      const smooth = (gains[Math.max(0, k - 1)] + gains[k] + gains[Math.min(bins - 1, k + 1)]) / 3;
      previous[k] = smooth >= previous[k] ? smooth : 0.6 * previous[k] + 0.4 * smooth;
    }
    for (let k = 0; k < bins; k++) {
      const g = previous[k];
      re[k] *= g;
      im[k] *= g;
      if (k > 0 && k < N / 2) {
        re[N - k] *= g;
        im[N - k] *= g;
      }
    }
    // Inverse FFT by conjugation.
    for (let i = 0; i < N; i++) im[i] = -im[i];
    fft(re, im);
    for (let i = 0; i < N; i++) out[offset + i] += ((re[i] / N) * window[i]) / 2;
  }
  return Float32Array.from(out.subarray(N, N + x.length));
}

/**
 * Where the tail ends: the last moment the sound's envelope rises clearly above the noise left in
 * the silence before it, or, if there was no silence to measure, above 1% of the peak.
 */
function tailEnd(x: Float32Array, first: number, noiseEnd: number, peak: number, sampleRate: number): number {
  const w = Math.max(1, Math.round(ENVELOPE_SEC * sampleRate));
  const rms = (from: number, to: number) => {
    let sum = 0;
    for (let i = from; i < to; i++) sum += x[i] * x[i];
    return Math.sqrt(sum / Math.max(1, to - from));
  };

  if (noiseEnd > w) {
    const threshold = Math.max(GATE_ABOVE_NOISE * rms(0, noiseEnd), GATE_FLOOR * peak);
    for (let end = x.length; end - w > first; end -= w) if (rms(end - w, end) > threshold) return end;
    return first + w;
  }
  let last = x.length - 1;
  while (last > first && Math.abs(x[last]) < peak * END_THRESHOLD) last--;
  return last + 1;
}

/** In-place radix-2 FFT; the length must be a power of two. */
export function fft(re: Float64Array, im: Float64Array) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let size = 2; size <= n; size <<= 1) {
    const angle = (-2 * Math.PI) / size;
    const wr = Math.cos(angle);
    const wi = Math.sin(angle);
    for (let start = 0; start < n; start += size) {
      let cr = 1, ci = 0;
      for (let k = 0; k < size / 2; k++) {
        const a = start + k;
        const b = a + size / 2;
        const tr = re[b] * cr - im[b] * ci;
        const ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr;
        im[b] = im[a] - ti;
        re[a] += tr;
        im[a] += ti;
        [cr, ci] = [cr * wr - ci * wi, cr * wi + ci * wr];
      }
    }
  }
}
