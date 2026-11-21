// Data shapes exchanged with the plugin (plugin/source/WebUiBridge.cpp).

import type { ParamId } from "../state/parameterIds";

export type ParameterKind = "float" | "int" | "bool" | "choice";

export interface ParameterInfo {
  id: ParamId;
  name: string;
  kind: ParameterKind;
  min: number;
  max: number;
  defaultValue: number;
  value: number; // plain value: Hz, seconds, choice index, 0/1 for bools...
  choices?: string[];
}

export interface SampleInfo {
  name: string;
  path: string;
  durationSec: number;
  sampleRate: number;
  channels: number;
  frames: number;
  /** Interleaved [min, max] pairs of channel 0 across the whole file. */
  peaks: number[];
}

/** Every place a sample can be loaded. One slot for now; add more keys for a multi-sample product. */
export interface SampleSlots {
  main: SampleInfo | null;
}

export type SampleSlot = keyof SampleSlots;

export interface PresetSummary {
  id: string;
  name: string;
  favorite: boolean;
}

export interface PresetList {
  items: PresetSummary[];
  currentId: string;
}

export type MasterTab = "playback" | "envelopes" | "filters";

/** Per-instance view settings, saved with the plugin state. */
export interface UiState {
  tab: MasterTab;
  waveformZoom: number;
  expandedWaveform: boolean;
  showGrid: boolean;
  snapToGrid: boolean;
  endLinked: boolean;
}

export interface InitialState {
  parameters: ParameterInfo[];
  samples: SampleSlots;
  presets: PresetList;
  uiState: Partial<UiState> | null;
  productName: string;
  version: string;
}

export interface Telemetry {
  peak: [number, number];
  /** Playhead of each sounding voice, as a fraction (0..1) of the sample. */
  voices: number[];
  hostBpm: number;
}

export interface OperationResult {
  ok: boolean;
  error?: string;
}
