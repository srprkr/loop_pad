// The loop transport's rules as pure functions: no AudioContext and no timers, so they can be
// unit-tested. engine.ts applies them on the Web Audio clock.
//
// Positions are in 16th-note steps from the start of the loop; the count-in is steps -12..-1.

import type { LoopNote, TransportMode } from "../types";

export const LOOP_STEPS = 64; // 4 bars of 16ths
export const COUNT_IN_STEPS = 12; // 3 beats

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
    const onBeat = step % 4 === 0;
    return {
      click: onBeat && metronome ? { countIn: true, accent: step === -COUNT_IN_STEPS } : null,
      recordBeat: false,
      startsTake: false,
      playStep: null,
    };
  }

  const loopStep = step % LOOP_STEPS;
  const recordingPass = recordRun && step < LOOP_STEPS;
  const onBeat = loopStep % 4 === 0;
  return {
    click: onBeat && metronome ? { countIn: false, accent: loopStep % 16 === 0 } : null,
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

/** BPM from tap times (ms): the average interval of taps within the last 3 s, or null. */
export function tapTempo(tapTimes: number[], now: number): { bpm: number | null; recent: number[] } {
  const recent = [...tapTimes.filter((t) => now - t < 3000), now];
  if (recent.length < 2) return { bpm: null, recent };
  const avgMs = (recent[recent.length - 1] - recent[0]) / (recent.length - 1);
  return { bpm: 60000 / avgMs, recent };
}
