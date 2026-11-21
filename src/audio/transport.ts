// The loop transport's rules as pure functions: no AudioContext and no timers, so they can be
// unit-tested. engine.ts applies them on the Web Audio clock.
//
// Positions are in steps (16th notes in 4/4) from the start of the loop; the count-in is the
// steps before 0 (-12..-1 with the values below).

import type { LoopNote, TransportMode } from "../types";

// The meter and loop length. Everything below is derived from these, so changing one (3/4, say)
// changes the metronome accents, the count-in and the loop together.
export const STEPS_PER_BEAT = 4; // 16th notes
export const BEATS_PER_BAR = 4; // 4/4
export const LOOP_BARS = 4;
export const COUNT_IN_BEATS = 3;

export const STEPS_PER_BAR = STEPS_PER_BEAT * BEATS_PER_BAR;
export const LOOP_STEPS = STEPS_PER_BAR * LOOP_BARS; // 64
export const COUNT_IN_STEPS = STEPS_PER_BEAT * COUNT_IN_BEATS; // 12

export interface RunState {
  running: boolean;
  /** The run started with REC (count-in + one recording pass), rather than PLAY. */
  recordRun: boolean;
}

/** What the transport is doing at a position. */
export function modeAt({ running, recordRun }: RunState, position: number): TransportMode {
  if (!running) return "idle";
  if (recordRun && position < 0) return "countIn";
  if (recordRun && position < LOOP_STEPS) return "recording";
  return "playing";
}

/** First step of a run: REC starts with the count-in, PLAY at step 0. */
export const startStep = (withRecording: boolean) => (withRecording ? -COUNT_IN_STEPS : 0);

/**
    The loop step a hit at `position` is recorded on, or null if it isn't recorded.
    Hits snap to the nearest 16th. A hit in the last half step of the count-in lands on step 0,
    and one in the last half step of the pass wraps to step 0.
*/
export function quantizeHit(run: RunState, position: number): number | null {
  if (!run.running || !run.recordRun) return null;
  if (position < -0.5 || position >= LOOP_STEPS) return null;
  return Math.max(0, Math.round(position)) % LOOP_STEPS;
}

/** Adds a hit to the loop; the same sound on the same step replaces the earlier hit. */
export function addHit(loop: LoopNote[], note: LoopNote): LoopNote[] {
  return [...loop.filter((n) => !(n.step === note.step && n.soundType === note.soundType)), note];
}

export interface StepActions {
  /** Metronome click on this step, if any. */
  click: { countIn: boolean; accent: boolean } | null;
  /** A beat of the recording pass (the metronome button flashes). */
  recordBeat: boolean;
  /** The recording pass starts here: a new take replaces the loop. */
  startsTake: boolean;
  /** Loop step whose recorded hits play now, or null (nothing plays during count-in and recording). */
  playStep: number | null;
}

/** What happens when the transport reaches `step` (an absolute step of the run). */
export function actionsForStep(recordRun: boolean, step: number, metronome: boolean): StepActions {
  if (step < 0) {
    const onBeat = (step + COUNT_IN_STEPS) % STEPS_PER_BEAT === 0;
    return {
      click: onBeat && metronome ? { countIn: true, accent: step === -COUNT_IN_STEPS } : null,
      recordBeat: false,
      startsTake: false,
      playStep: null,
    };
  }

  const loopStep = step % LOOP_STEPS;
  const recordingPass = recordRun && step < LOOP_STEPS;
  const onBeat = loopStep % STEPS_PER_BEAT === 0;
  return {
    click: onBeat && metronome ? { countIn: false, accent: loopStep % STEPS_PER_BAR === 0 } : null,
    recordBeat: onBeat && recordingPass,
    startsTake: recordingPass && step === 0,
    playStep: recordingPass ? null : loopStep,
  };
}

/** The step to show: 0 when idle, -12..-1 in the count-in, otherwise 0..63. */
export function displayStep(mode: TransportMode, position: number): number {
  if (mode === "idle") return 0;
  if (mode === "countIn") return Math.floor(position);
  return Math.floor(position) % LOOP_STEPS;
}

/**
 * The count-in number to show for a displayed step: the beats left (3, 2, 1) on each count-in
 * beat, then "GO!" for the first beat of the recording, otherwise null.
 */
export function countdownLabel(mode: TransportMode, step: number): string | null {
  if (mode === "countIn") {
    // Which count-in beat this is, from 0. Not below 0: for the 50 ms before the first click is
    // due, the step reads one before the count-in starts.
    const beat = Math.max(0, Math.floor((step + COUNT_IN_STEPS) / STEPS_PER_BEAT));
    return String(COUNT_IN_BEATS - beat);
  }
  if (mode === "recording" && step < STEPS_PER_BEAT) return "GO!";
  return null;
}

/** BPM from tap times (ms): the average interval of taps within the last 3 s, or null. */
export function tapTempo(tapTimes: number[], now: number): { bpm: number | null; recent: number[] } {
  const recent = [...tapTimes.filter((t) => now - t < 3000), now];
  if (recent.length < 2) return { bpm: null, recent };
  const avgMs = (recent[recent.length - 1] - recent[0]) / (recent.length - 1);
  return { bpm: 60000 / avgMs, recent };
}
