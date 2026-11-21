// The Loop Pad audio engine: the prototype's Web Audio synth plus the loop transport
// (source_code.jsx:910-1046).
//
//   - REC: 3-beat count-in, then exactly 4 bars (64 sixteenth steps) of recording, then the loop
//     plays back. Hits snap to the nearest 16th; a hit in the last half step of the count-in
//     lands on step 0. A new take replaces the loop once it starts recording.
//   - PLAY: loops from step 0. The metronome clicks on quarter notes (accent on each bar) during
//     the count-in, recording and playback.
//
// Timing uses Web Audio's clock with a 100 ms look-ahead scheduler, so hits and clicks land
// exactly on their steps even though the scheduler itself runs on a timer.

import type { LoopNote, PadHit, Settings, Telemetry } from "../types";
import { actionsForStep, addHit, displayStep, modeAt, quantizeHit, startStep } from "./transport";
import { createNoiseBuffer, playMetronomeClick, triggerSound } from "./webSynth";

const LOOKAHEAD_SEC = 0.1;
const SCHEDULE_INTERVAL_MS = 25;
const TELEMETRY_INTERVAL_MS = 33;

type TimedEvent = { time: number } & ({ kind: "beat" } | { kind: "hit"; hit: PadHit });

export interface AudioEngine {
  /**
      Creates or resumes the audio output. Browsers only allow this during certain user
      gestures (a tap's touchend / pointerup, a click, a key), so the app calls it on those.
  */
  unlock(): void;
  setSettings(settings: Settings): void;
  /** Plays a pad. While recording, the hit is also quantized into the loop. */
  triggerPad(soundType: string, pitchSemitones: number, volume: number, padKey: string): void;
  /** Plays a sound without recording it (inspector auditions). */
  previewSound(soundType: string, pitchSemitones: number, volume: number): void;
  /** REC: starts the count-in, or stops while counting in / recording. */
  record(): void;
  /** PLAY / PAUSE. Playback always starts from step 0. */
  togglePlay(): void;
  stop(): void;
  getLoop(): LoopNote[];
  setLoop(loop: LoopNote[]): void;
  onTelemetry(fn: (t: Telemetry) => void): () => void;
  /** Called whenever the recorded loop changes. */
  onLoopChange(fn: (loop: LoopNote[]) => void): () => void;
}

export function createAudioEngine(initial: Settings): AudioEngine {
  let settings = initial;

  //==========================================================================
  // Audio graph, created on the first user gesture (browsers block audio before that).
  let audio: { ctx: AudioContext; master: GainNode; noise: AudioBuffer } | null = null;

  const masterLevel = () => (settings.muted ? 0 : settings.volume);

  function getAudio() {
    if (!audio) {
      // iOS: play as media, so the ringer/silent switch doesn't mute the pads (Safari 16.4+).
      const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
      if (session) session.type = "playback";

      const ctx = new AudioContext();
      const master = ctx.createGain();
      master.gain.setValueAtTime(masterLevel(), ctx.currentTime);
      master.connect(ctx.destination);
      audio = { ctx, master, noise: createNoiseBuffer(ctx) };
    }
    if (audio.ctx.state === "suspended") void audio.ctx.resume();
    return audio;
  }

  //==========================================================================
  // Transport. Steps are counted from the start of the loop; the count-in is steps -12..-1.
  let running = false;
  let recordRun = false; // this run started with REC (count-in + one recording pass)
  let loopClearedForTake = false;
  let nextStep = 0;
  let nextStepTime = 0;
  let loop: LoopNote[] = [];
  let timedEvents: TimedEvent[] = [];
  let recordBeat = 0;

  const telemetryListeners = new Set<(t: Telemetry) => void>();
  const loopListeners = new Set<(loop: LoopNote[]) => void>();
  const loopChanged = () => loopListeners.forEach((fn) => fn(loop));

  const secondsPerStep = () => 60 / settings.bpm / 4;
  const positionAt = (time: number) => nextStep - (nextStepTime - time) / secondsPerStep();
  const run = () => ({ running, recordRun });
  const currentMode = () => (running && audio ? modeAt(run(), positionAt(audio.ctx.currentTime)) : "idle");

  function clearLoopForNewTake() {
    if (loopClearedForTake) return;
    loopClearedForTake = true;
    loop = [];
    loopChanged();
  }

  function start(withRecording: boolean) {
    const { ctx } = getAudio();
    running = true;
    recordRun = withRecording;
    loopClearedForTake = false;
    nextStep = startStep(withRecording);
    nextStepTime = ctx.currentTime + 0.05;
    timedEvents = [];
  }

  function stop() {
    running = false;
    timedEvents = [];
  }

  function schedule() {
    if (!running || !audio) return;
    const { ctx, master, noise } = audio;

    while (nextStepTime < ctx.currentTime + LOOKAHEAD_SEC) {
      const step = nextStep;
      const time = nextStepTime;
      const actions = actionsForStep(recordRun, step, settings.metronome);

      if (actions.click) playMetronomeClick(ctx, master, time, actions.click.countIn, actions.click.accent);
      if (actions.recordBeat) timedEvents.push({ time, kind: "beat" });
      if (actions.startsTake) clearLoopForNewTake();

      if (actions.playStep !== null) {
        for (const note of loop) {
          if (note.step !== actions.playStep) continue;
          triggerSound(ctx, master, noise, note.soundType, note.pitchSemitones, note.volume, time);
          timedEvents.push({ time, kind: "hit", hit: { padKey: note.padKey, soundType: note.soundType } });
        }
      }

      nextStep = step + 1;
      nextStepTime = time + secondsPerStep();
    }
  }

  function recordHit(soundType: string, pitchSemitones: number, volume: number, padKey: string, time: number) {
    const step = quantizeHit(run(), positionAt(time));
    if (step === null) return;

    clearLoopForNewTake();
    loop = addHit(loop, { step, soundType, pitchSemitones, volume, padKey });
    loopChanged();
  }

  function telemetry(): Telemetry {
    const now = audio?.ctx.currentTime ?? 0;
    const hits: PadHit[] = [];
    timedEvents = timedEvents.filter((e) => {
      if (e.time > now) return true;
      if (e.kind === "beat") recordBeat++;
      else hits.push(e.hit);
      return false;
    });

    const position = running ? positionAt(now) : 0;
    const mode = modeAt(run(), position);
    return { mode, step: displayStep(mode, position), recordBeat, hits, loopLength: loop.length };
  }

  window.setInterval(schedule, SCHEDULE_INTERVAL_MS);
  window.setInterval(() => {
    const t = telemetry();
    telemetryListeners.forEach((fn) => fn(t));
  }, TELEMETRY_INTERVAL_MS);

  //==========================================================================
  return {
    unlock() {
      getAudio();
    },

    setSettings(next) {
      settings = next;
      if (audio) audio.master.gain.setTargetAtTime(masterLevel(), audio.ctx.currentTime, 0.01);
    },

    triggerPad(soundType, pitch, volume, padKey) {
      const { ctx, master, noise } = getAudio();
      triggerSound(ctx, master, noise, soundType, pitch, volume, ctx.currentTime);
      recordHit(soundType, pitch, volume, padKey, ctx.currentTime);
    },

    previewSound(soundType, pitch, volume) {
      const { ctx, master, noise } = getAudio();
      triggerSound(ctx, master, noise, soundType, pitch, volume, ctx.currentTime);
    },

    record() {
      const mode = currentMode();
      if (mode === "countIn" || mode === "recording") stop();
      else start(true);
    },

    togglePlay() {
      if (currentMode() === "playing") stop();
      else start(false);
    },

    stop,

    getLoop: () => loop,

    setLoop(next) {
      loop = next;
      loopChanged();
    },

    onTelemetry(fn) {
      telemetryListeners.add(fn);
      return () => telemetryListeners.delete(fn);
    },

    onLoopChange(fn) {
      loopListeners.add(fn);
      return () => loopListeners.delete(fn);
    },
  };
}
