// In-browser stand-in for the plugin, used by `npm run dev` outside a DAW.
//
// It keeps state in memory and runs the prototype's Web Audio synth and loop transport, so the
// UI makes sound in a browser. The real engine is C++ (engine/src/LoopPadEngine.cpp) and follows
// the same rules:
//   - REC: 3-beat count-in, then exactly 4 bars (64 sixteenth steps) of recording, then the
//     loop plays back. Hits snap to the nearest 16th; a hit in the last half step of the
//     count-in lands on step 0. Recording replaces the previous loop.
//   - PLAY: loops from step 0. Metronome clicks on quarter notes, accent on each bar.

import type { Backend, PluginEvents } from "./api";
import type { InitialState, KitState, LoopNote, PadHit, Telemetry, TransportMode, UiState } from "./types";
import { createNoiseBuffer, playMetronomeClick, triggerSound } from "../audio/webSynth";
import { DEFAULT_PARAMETERS } from "../state/defaults";
import type { ParamId } from "../state/parameterIds";

type Listener = (payload: unknown) => void;

const LOOP_STEPS = 64;
const COUNT_IN_STEPS = 12; // 3 beats
const LOOKAHEAD_SEC = 0.1;

type TimedEvent = { time: number } & ({ kind: "beat" } | { kind: "hit"; hit: PadHit });

export function createMockBackend(): Backend {
  const listeners = new Map<string, Set<Listener>>();
  const emit = <K extends keyof PluginEvents>(event: K, payload: PluginEvents[K]) =>
    listeners.get(event)?.forEach((fn) => fn(payload));

  const params = new Map<ParamId, number>(DEFAULT_PARAMETERS.map((p) => [p.id, p.defaultValue]));
  const param = (id: ParamId) => params.get(id) ?? 0;
  let uiState: Partial<UiState> | null = null;
  let kit: KitState | null = null;

  //==========================================================================
  // Audio graph, created on the first user gesture (browsers block audio before that).
  let audio: { ctx: AudioContext; master: GainNode; noise: AudioBuffer } | null = null;

  const masterLevel = () => (param("mute") >= 0.5 ? 0 : param("masterVolume"));

  function getAudio() {
    if (!audio) {
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

  const secondsPerStep = () => 60 / param("bpm") / 4;
  const positionAt = (time: number) => nextStep - (nextStepTime - time) / secondsPerStep();

  function modeAt(position: number): TransportMode {
    if (!running) return "idle";
    if (recordRun && position < 0) return "countIn";
    if (recordRun && position < LOOP_STEPS) return "recording";
    return "playing";
  }

  function clearLoopForNewTake() {
    if (loopClearedForTake) return;
    loopClearedForTake = true;
    loop = [];
  }

  function start(withRecording: boolean) {
    const { ctx } = getAudio();
    running = true;
    recordRun = withRecording;
    loopClearedForTake = false;
    nextStep = withRecording ? -COUNT_IN_STEPS : 0;
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
    const metronome = param("metronome") >= 0.5;

    while (nextStepTime < ctx.currentTime + LOOKAHEAD_SEC) {
      const step = nextStep;
      const time = nextStepTime;

      if (step < 0) {
        if (step % 4 === 0 && metronome) playMetronomeClick(ctx, master, time, true, step === -COUNT_IN_STEPS);
      } else {
        const loopStep = step % LOOP_STEPS;
        const recordingPass = recordRun && step < LOOP_STEPS;

        if (loopStep % 4 === 0) {
          if (metronome) playMetronomeClick(ctx, master, time, false, loopStep % 16 === 0);
          if (recordingPass) timedEvents.push({ time, kind: "beat" });
        }

        if (recordingPass) {
          if (step === 0) clearLoopForNewTake();
        } else {
          for (const note of loop) {
            if (note.step !== loopStep) continue;
            triggerSound(ctx, master, noise, note.soundType, note.pitchSemitones, note.volume, time);
            timedEvents.push({ time, kind: "hit", hit: { padKey: note.padKey, soundType: note.soundType } });
          }
        }
      }

      nextStep = step + 1;
      nextStepTime = time + secondsPerStep();
    }
  }

  function recordHit(soundType: string, pitchSemitones: number, volume: number, padKey: string, time: number) {
    if (!running || !recordRun) return;
    const position = positionAt(time);
    if (position < -0.5 || position >= LOOP_STEPS) return;

    const step = Math.max(0, Math.round(position)) % LOOP_STEPS;
    clearLoopForNewTake();
    loop = loop.filter((n) => !(n.step === step && n.soundType === soundType));
    loop.push({ step, soundType, pitchSemitones, volume, padKey });
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
    const mode = modeAt(position);
    const step = mode === "idle" ? 0 : mode === "countIn" ? Math.floor(position) : Math.floor(position) % LOOP_STEPS;

    return {
      peak: [0, 0],
      mode,
      step,
      recordBeat,
      bpm: param("bpm"),
      hostSynced: false,
      hits,
      loopLength: loop.length,
    };
  }

  window.setInterval(schedule, 25);
  window.setInterval(() => emit("telemetry", telemetry()), 33);

  //==========================================================================
  const handlers: Record<string, (...args: never[]) => unknown> = {
    getInitialState: (): InitialState => ({
      parameters: DEFAULT_PARAMETERS.map((p) => ({ ...p, value: params.get(p.id) ?? p.defaultValue })),
      kit,
      uiState,
      productName: "Loop Pad",
      version: "dev",
    }),
    setUiState: (state: UiState) => { uiState = state; },
    setKit: (state: KitState) => { kit = state; },

    setParameter: (id: ParamId, value: number) => {
      params.set(id, value);
      if (audio && (id === "masterVolume" || id === "mute"))
        audio.master.gain.setTargetAtTime(masterLevel(), audio.ctx.currentTime, 0.01);
    },
    beginGesture: () => undefined,
    endGesture: () => undefined,

    triggerPad: (soundType: string, pitch: number, volume: number, padKey: string) => {
      const { ctx, master, noise } = getAudio();
      triggerSound(ctx, master, noise, soundType, pitch, volume, ctx.currentTime);
      recordHit(soundType, pitch, volume, padKey, ctx.currentTime);
    },
    previewSound: (soundType: string, pitch: number, volume: number) => {
      const { ctx, master, noise } = getAudio();
      triggerSound(ctx, master, noise, soundType, pitch, volume, ctx.currentTime);
    },

    record: () => {
      const mode = running && audio ? modeAt(positionAt(audio.ctx.currentTime)) : "idle";
      if (mode === "countIn" || mode === "recording") stop();
      else start(true);
    },
    togglePlay: () => {
      const mode = running && audio ? modeAt(positionAt(audio.ctx.currentTime)) : "idle";
      if (mode === "playing") stop();
      else start(false);
    },
    stop: () => stop(),
  };

  return {
    call: async <T,>(name: string, ...args: unknown[]) => {
      const handler = handlers[name] as ((...a: unknown[]) => unknown) | undefined;
      if (!handler) throw new Error(`Mock backend has no '${name}'`);
      return (await handler(...args)) as T;
    },
    on: (event, fn) => {
      const set = listeners.get(event) ?? new Set<Listener>();
      set.add(fn as Listener);
      listeners.set(event, set);
      return () => set.delete(fn as Listener);
    },
  };
}
