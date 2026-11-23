// Turns a raw microphone recording into a pad sound: mixed to mono, the silence before and after
// the sound trimmed off (so the pad plays the moment you hit it), and the level evened out (so a
// quiet recording isn't buried under the kit). Pure, so it can be unit-tested.

/** Longest recording, in seconds. Pad sounds are short; this also keeps the stored audio small. */
export const MAX_RECORDING_SEC = 3;

/** The trimmed sound starts where it first reaches this fraction of its peak... */
const START_THRESHOLD = 0.05;
/** ...minus this much, so the attack isn't clipped. */
const PRE_ROLL_SEC = 0.003;
/** It ends where it last reaches this fraction of its peak, with a short fade-out. */
const END_THRESHOLD = 0.01;
const FADE_OUT_SEC = 0.01;
/** The peak level after normalizing: -3 dBFS, leaving headroom for pad volumes above 100%. */
export const NORMALIZED_PEAK = 10 ** (-3 / 20);
/** A recording whose peak is below this (-46 dBFS) is treated as silence. */
export const SILENCE_PEAK = 0.005;

/** Mono, trimmed and normalized samples, or null if the recording was silent. */
export function prepareRecording(channels: Float32Array[], sampleRate: number): Float32Array | null {
  if (channels.length === 0 || channels[0].length === 0) return null;

  // Mix to mono.
  const length = channels[0].length;
  const mono = new Float32Array(length);
  for (const channel of channels) for (let i = 0; i < length; i++) mono[i] += channel[i] / channels.length;

  let peak = 0;
  for (const v of mono) peak = Math.max(peak, Math.abs(v));
  if (peak < SILENCE_PEAK) return null;

  // Trim to where the sound is.
  let first = 0;
  while (first < length && Math.abs(mono[first]) < peak * START_THRESHOLD) first++;
  let last = length - 1;
  while (last > first && Math.abs(mono[last]) < peak * END_THRESHOLD) last--;
  const fade = Math.round(FADE_OUT_SEC * sampleRate);
  const start = Math.max(0, first - Math.round(PRE_ROLL_SEC * sampleRate));
  const end = Math.min(length, last + 1 + fade);
  const out = mono.slice(start, end);

  // Normalize, and fade out the tail so it doesn't end with a click.
  const gain = NORMALIZED_PEAK / peak;
  const fadeStart = Math.max(0, out.length - fade);
  for (let i = 0; i < out.length; i++) {
    const fadeGain = i < fadeStart ? 1 : (out.length - i) / (out.length - fadeStart);
    out[i] *= gain * fadeGain;
  }
  return out;
}
