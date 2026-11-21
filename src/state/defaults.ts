// Default state for a first visit (or after the saved state is cleared).

import { DEFAULT_PADS } from "../data/defaultPads";
import type { KitState, Settings, UiState } from "../types";

// Ranges and defaults follow the prototype (source_code.jsx:212-217).
export const BPM_RANGE = { min: 60, max: 200 } as const;

export const DEFAULT_SETTINGS: Settings = {
  volume: 0.85,
  muted: false,
  bpm: 120,
  metronome: true,
};

export const DEFAULT_KIT: KitState = {
  gridSize: "4x4",
  pads: DEFAULT_PADS,
};

export const DEFAULT_UI_STATE: UiState = {
  inspectorOpen: false,
  selectedPad: { "3x3": 0, "4x4": 0, "5x5": 0 },
};
