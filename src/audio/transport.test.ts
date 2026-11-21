import { describe, expect, it } from "vitest";
import type { LoopNote } from "../types";
import { COUNT_IN_STEPS, LOOP_STEPS, actionsForStep, addHit, displayStep, modeAt, quantizeHit, startStep, tapTempo } from "./transport";

const recording = { running: true, recordRun: true };
const playing = { running: true, recordRun: false };
const stopped = { running: false, recordRun: false };

const note = (step: number, soundType: string, volume = 1, padKey = "1"): LoopNote => ({ step, soundType, pitchSemitones: 0, volume, padKey });

/** Runs actionsForStep over a range of absolute steps. */
const stepsOf = (recordRun: boolean, from: number, to: number, metronome = true) =>
  Array.from({ length: to - from }, (_, i) => ({ step: from + i, ...actionsForStep(recordRun, from + i, metronome) }));

describe("REC: count-in, one 4-bar take, then loop", () => {
  it("counts in three beats, records 64 steps, then plays", () => {
    expect(COUNT_IN_STEPS).toBe(12);
    expect(LOOP_STEPS).toBe(64);
    expect(startStep(true)).toBe(-12);

    expect(modeAt(recording, -12)).toBe("countIn");
    expect(modeAt(recording, -0.01)).toBe("countIn");
    expect(modeAt(recording, 0)).toBe("recording");
    expect(modeAt(recording, 63.99)).toBe("recording");
    expect(modeAt(recording, 64)).toBe("playing"); // loops straight into playback
    expect(modeAt(recording, 500)).toBe("playing");
  });

  it("PLAY starts at step 0 and only plays", () => {
    expect(startStep(false)).toBe(0);
    expect(modeAt(playing, 0)).toBe("playing");
    expect(modeAt(playing, 70)).toBe("playing");
  });

  it("is idle when stopped", () => {
    expect(modeAt(stopped, 10)).toBe("idle");
  });

  it("starts a new take only when recording starts, not at the count-in", () => {
    const starts = stepsOf(true, -12, 200).filter((s) => s.startsTake);
    expect(starts.map((s) => s.step)).toEqual([0]);
    expect(stepsOf(false, 0, 200).some((s) => s.startsTake)).toBe(false);
  });

  it("plays nothing during the count-in and the recording pass, then every loop step", () => {
    const steps = stepsOf(true, -12, 64 * 3);
    expect(steps.filter((s) => s.step < 64).every((s) => s.playStep === null)).toBe(true);
    expect(steps.filter((s) => s.step >= 64).map((s) => s.playStep)).toEqual(
      Array.from({ length: 128 }, (_, i) => i % 64),
    );
  });

  it("counts 16 recording beats per take (the metronome button flashes on each)", () => {
    expect(stepsOf(true, -12, 64 * 3).filter((s) => s.recordBeat)).toHaveLength(16);
    expect(stepsOf(false, 0, 64 * 3).some((s) => s.recordBeat)).toBe(false);
  });
});

describe("recording hits", () => {
  it("snaps to the nearest 16th", () => {
    expect(quantizeHit(recording, 10.4)).toBe(10);
    expect(quantizeHit(recording, 10.6)).toBe(11);
    expect(quantizeHit(recording, 0)).toBe(0);
  });

  it("puts a hit in the last half step of the count-in on step 0, and drops earlier ones", () => {
    expect(quantizeHit(recording, -0.4)).toBe(0);
    expect(quantizeHit(recording, -0.5)).toBe(0);
    expect(quantizeHit(recording, -0.6)).toBeNull();
    expect(quantizeHit(recording, -8)).toBeNull();
  });

  it("wraps a hit at the very end of the take to step 0", () => {
    expect(quantizeHit(recording, 63.4)).toBe(63);
    expect(quantizeHit(recording, 63.7)).toBe(0);
  });

  it("doesn't record during playback, after the take, or when stopped", () => {
    expect(quantizeHit(recording, 64)).toBeNull();
    expect(quantizeHit(recording, 100)).toBeNull();
    expect(quantizeHit(playing, 10)).toBeNull();
    expect(quantizeHit(stopped, 10)).toBeNull();
  });

  it("replaces the same sound on the same step; the later hit wins", () => {
    let loop = addHit([], note(4, "clap", 1));
    loop = addHit(loop, note(4, "clap", 0.3));
    expect(loop).toEqual([note(4, "clap", 0.3)]);
  });

  it("keeps different sounds on the same step, and the same sound on other steps", () => {
    let loop = addHit([], note(4, "clap"));
    loop = addHit(loop, note(4, "punch_kick", 1, "Z"));
    loop = addHit(loop, note(5, "clap"));
    expect(loop).toHaveLength(3);
  });

  it("doesn't change the loop it was given", () => {
    const loop = [note(4, "clap")];
    addHit(loop, note(4, "clap", 0.5));
    expect(loop).toEqual([note(4, "clap")]);
  });
});

describe("metronome", () => {
  it("clicks on the three count-in beats, accenting the first", () => {
    const clicks = stepsOf(true, -12, 0).filter((s) => s.click);
    expect(clicks.map((s) => [s.step, s.click])).toEqual([
      [-12, { countIn: true, accent: true }],
      [-8, { countIn: true, accent: false }],
      [-4, { countIn: true, accent: false }],
    ]);
  });

  it("clicks on every quarter note, accenting each bar", () => {
    const clicks = stepsOf(false, 0, 64).filter((s) => s.click);
    expect(clicks).toHaveLength(16);
    expect(clicks.filter((s) => s.click!.accent).map((s) => s.step)).toEqual([0, 16, 32, 48]);
    expect(clicks.every((s) => !s.click!.countIn)).toBe(true);
  });

  it("is silent when turned off, but recording beats still count", () => {
    const steps = stepsOf(true, -12, 64, false);
    expect(steps.some((s) => s.click)).toBe(false);
    expect(steps.filter((s) => s.recordBeat)).toHaveLength(16);
  });
});

describe("display step", () => {
  it("shows 0 when idle, the count-in as negative steps, then 0..63", () => {
    expect(displayStep("idle", 42)).toBe(0);
    expect(displayStep("countIn", -11.5)).toBe(-12);
    expect(displayStep("recording", 10.7)).toBe(10);
    expect(displayStep("playing", 64 + 5.2)).toBe(5);
  });
});

describe("TAP tempo", () => {
  it("needs two taps", () => {
    expect(tapTempo([], 1000).bpm).toBeNull();
  });

  it("averages the intervals: taps 500 ms apart are 120 BPM", () => {
    expect(tapTempo([0, 500, 1000], 1500).bpm).toBeCloseTo(120);
  });

  it("forgets taps older than 3 s", () => {
    const { bpm, recent } = tapTempo([0, 5000], 5400);
    expect(recent).toEqual([5000, 5400]);
    expect(bpm).toBeCloseTo(150);
  });
});
