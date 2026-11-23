// Shared data shapes.

import type { SoundCategory } from "./data/kit";
import type { ColorThemeKey } from "./data/themes";

export type GridSize = "3x3" | "4x4" | "5x5";

export interface PadConfig {
  id: string;
  name: string;
  category: SoundCategory;
  colorKey: ColorThemeKey;
  key: string;
  soundType: string;
  pitchSemitones: number; // -12 .. +12
  volume: number; // 0 .. 1.3
}

/** A sound recorded with the mic. Its audio is in IndexedDB (recordingsDb.ts), keyed by id. */
export interface Recording {
  id: string; // "rec_…"
  name: string;
}

/** The three pad sets and which one is showing. */
export interface KitState {
  gridSize: GridSize;
  pads: Record<GridSize, PadConfig[]>;
}

/** Master volume, mute, tempo and metronome. */
export interface Settings {
  volume: number; // 0..1
  muted: boolean;
  bpm: number; // 60..200
  metronome: boolean;
}

/** View settings. */
export interface UiState {
  inspectorOpen: boolean;
  selectedPad: Record<GridSize, number>;
}

export type TransportMode = "idle" | "countIn" | "recording" | "playing";

/** One recorded hit: a snapshot of the pad at the moment it was played. */
export interface LoopNote {
  step: number; // 0..63
  soundType: string;
  pitchSemitones: number;
  volume: number;
  padKey: string;
}

export interface PadHit {
  padKey: string;
  soundType: string;
}

/** What the engine reports ~30 times a second. */
export interface Telemetry {
  mode: TransportMode;
  /** Current 16th step, 0..63 (count-in: -12..-1). */
  step: number;
  /** Counts metronome beats during recording; the metronome button flashes when it changes. */
  recordBeat: number;
  /** Loop-playback hits since the last report. */
  hits: PadHit[];
  /** Number of hits in the recorded loop. */
  loopLength: number;
}
