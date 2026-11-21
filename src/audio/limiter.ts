// A peak limiter for the master output, so loud hits (the kicks, or several hits at once) don't
// clip. It runs inside an AudioWorklet (limiter.worklet.ts); the maths is here so it can be
// unit-tested.
//
// No look-ahead, so it adds no delay: the gain drops on the very sample that would go over the
// ceiling, holds for 20 ms (longer than a 50 Hz cycle, so a loud bass note is turned down as a
// whole rather than flattened on every peak), then recovers smoothly. The output never exceeds the ceiling, and sounds that stay
// below it pass through unchanged. (The browsers' DynamicsCompressorNode was tried first: it adds
// 6 ms of delay, lets peaks through in Chromium, and boosts or cuts quiet sounds differently in
// each browser.)

/** The name the worklet registers its processor under. */
export const LIMITER_PROCESSOR = "loop-pad-limiter";

/** Highest output level: -1 dBFS. */
export const LIMITER_CEILING = 10 ** (-1 / 20);
/** How long the gain stays down after the last peak before it starts to recover. */
export const LIMITER_HOLD_SEC = 0.02;
/** Then the time to recover most of the way (to within 1/e). */
export const LIMITER_RELEASE_SEC = 0.08;

export interface LimiterState {
  /** The gain currently applied, 0..1. */
  gain: number;
  /** Samples left before the gain may recover. */
  hold: number;
}

export interface LimiterTiming {
  /** Per-sample release factor. */
  release: number;
  holdSamples: number;
}

export const limiterTiming = (sampleRate: number): LimiterTiming => ({
  release: Math.exp(-1 / (LIMITER_RELEASE_SEC * sampleRate)),
  holdSamples: Math.round(LIMITER_HOLD_SEC * sampleRate),
});

export const newLimiterState = (): LimiterState => ({ gain: 1, hold: 0 });

/**
 * Limits one block of audio. `input` and `output` are per channel; all channels share one gain,
 * so the stereo image doesn't shift.
 */
export function limitBlock(input: Float32Array[], output: Float32Array[], state: LimiterState, timing: LimiterTiming) {
  if (input.length === 0) return; // nothing connected
  const frames = input[0].length;
  let { gain, hold } = state;
  for (let i = 0; i < frames; i++) {
    let peak = 0;
    for (const channel of input) peak = Math.max(peak, Math.abs(channel[i]));

    // Recover towards unity once the hold is over, but never above what keeps this sample under
    // the ceiling. Reaching the ceiling (or near it) restarts the hold.
    if (hold > 0) hold--;
    else gain = 1 - (1 - gain) * timing.release;
    if (peak * gain > LIMITER_CEILING) gain = LIMITER_CEILING / peak;
    if (gain < 1 && peak * gain > LIMITER_CEILING * 0.98) hold = timing.holdSamples;

    for (let c = 0; c < output.length; c++) output[c][i] = (input[c] ?? input[0])[i] * gain;
  }
  state.gain = gain;
  state.hold = hold;
}
