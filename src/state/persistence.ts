// Saving and restoring the app state in localStorage.
//
// parseSavedState is pure (it takes the stored text), so it can be unit-tested; it keeps only
// what is valid and fills in the rest with defaults, so an old or hand-edited save can't break
// the app.

import { LOOP_STEPS } from "../audio/transport";
import { findSound } from "../data/kit";
import type { GridSize, KitState, LoopNote, Settings, UiState } from "../types";
import { BPM_RANGE, DEFAULT_KIT, DEFAULT_SETTINGS, DEFAULT_UI_STATE } from "./defaults";

export const STORAGE_KEY = "loop-pad:v1";

export interface SavedState {
  settings: Settings;
  kit: KitState;
  ui: UiState;
  loop: LoopNote[];
}

export const clamp = (v: unknown, min: number, max: number, fallback: number) =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;

/** The stored text, or null if there is none (or storage is unavailable). */
export function readSavedState(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function writeSavedState(state: SavedState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage full or disabled (private browsing): keep working without saving.
  }
}

/** Parses stored text into a complete, valid state. */
export function parseSavedState(text: string | null): SavedState {
  let saved: Partial<SavedState> = {};
  try {
    const parsed: unknown = JSON.parse(text ?? "{}");
    if (parsed && typeof parsed === "object") saved = parsed as Partial<SavedState>;
  } catch {
    // Unreadable: start fresh.
  }

  const s: Partial<Settings> = saved.settings ?? {};
  const settings: Settings = {
    volume: clamp(s.volume, 0, 1, DEFAULT_SETTINGS.volume),
    muted: typeof s.muted === "boolean" ? s.muted : DEFAULT_SETTINGS.muted,
    bpm: Math.round(clamp(s.bpm, BPM_RANGE.min, BPM_RANGE.max, DEFAULT_SETTINGS.bpm)),
    metronome: typeof s.metronome === "boolean" ? s.metronome : DEFAULT_SETTINGS.metronome,
  };

  // A pad set is kept only if it is complete and every pad plays a known sound.
  const pads = { ...DEFAULT_KIT.pads };
  for (const size of Object.keys(pads) as GridSize[]) {
    const list = saved.kit?.pads?.[size];
    if (Array.isArray(list) && list.length === DEFAULT_KIT.pads[size].length && list.every((p) => findSound(p?.soundType)))
      pads[size] = list;
  }
  const gridSize = saved.kit?.gridSize && pads[saved.kit.gridSize] ? saved.kit.gridSize : DEFAULT_KIT.gridSize;

  const ui: UiState = {
    inspectorOpen: saved.ui?.inspectorOpen === true,
    selectedPad: { ...DEFAULT_UI_STATE.selectedPad, ...(saved.ui?.selectedPad ?? {}) },
  };

  const loop = Array.isArray(saved.loop)
    ? saved.loop.filter((n) => Number.isInteger(n?.step) && n.step >= 0 && n.step < LOOP_STEPS && findSound(n.soundType))
    : [];

  return { settings, kit: { gridSize, pads }, ui, loop };
}
