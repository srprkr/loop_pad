// Data shapes exchanged with the plugin (plugin/source/WebUiBridge.cpp).

import type { SoundCategory } from "../data/kit";
import type { ColorThemeKey } from "../data/themes";
import type { ParamId } from "../state/parameterIds";

export type ParameterKind = "float" | "int" | "bool" | "choice";

export interface ParameterInfo {
  id: ParamId;
  name: string;
  kind: ParameterKind;
  min: number;
  max: number;
  defaultValue: number;
  value: number; // plain value: 0..1 gain, BPM, 0/1 for bools...
  choices?: string[];
}

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

/** The three pad sets and which one is showing. Saved with the plugin state; drives MIDI input. */
export interface KitState {
  gridSize: GridSize;
  pads: Record<GridSize, PadConfig[]>;
}

/** Per-instance view settings, saved with the plugin state. */
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

export interface InitialState {
  parameters: ParameterInfo[];
  kit: KitState | null;
  uiState: Partial<UiState> | null;
  productName: string;
  version: string;
}

export interface PadHit {
  padKey: string;
  soundType: string;
}

export interface Telemetry {
  peak: [number, number];
  mode: TransportMode;
  /** Current 16th step, 0..63 (count-in: -12..-1). */
  step: number;
  /** Counts metronome beats during recording; the metronome button flashes when it changes. */
  recordBeat: number;
  /** Tempo the transport is running at (the host's while the host plays). */
  bpm: number;
  hostSynced: boolean;
  /** Loop-playback hits since the last telemetry message. */
  hits: PadHit[];
  /** Number of hits in the recorded loop. */
  loopLength: number;
}
