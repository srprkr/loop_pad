// Default values used before the plugin answers, and by the browser mock backend.
// The plugin's own parameter list (Parameters.cpp) is authoritative at runtime.

import type { KitState, ParameterInfo, UiState } from "../bridge/types";
import { DEFAULT_PADS } from "../data/defaultPads";
import type { ParamId } from "./parameterIds";

const float = (id: ParamId, name: string, min: number, max: number, defaultValue: number): ParameterInfo => ({
  id, name, kind: "float", min, max, defaultValue, value: defaultValue,
});
const int = (id: ParamId, name: string, min: number, max: number, defaultValue: number): ParameterInfo => ({
  id, name, kind: "int", min, max, defaultValue, value: defaultValue,
});
const bool = (id: ParamId, name: string, defaultValue: boolean): ParameterInfo => ({
  id, name, kind: "bool", min: 0, max: 1, defaultValue: Number(defaultValue), value: Number(defaultValue),
});

export const DEFAULT_PARAMETERS: ParameterInfo[] = [
  float("masterVolume", "Volume", 0, 1, 0.85),
  bool("mute", "Mute", false),
  int("bpm", "Tempo", 60, 200, 120),
  bool("metronome", "Metronome", true),
];

export const DEFAULT_KIT: KitState = {
  gridSize: "4x4",
  pads: DEFAULT_PADS,
};

export const DEFAULT_UI_STATE: UiState = {
  inspectorOpen: false,
  selectedPad: { "3x3": 0, "4x4": 0, "5x5": 0 },
};
