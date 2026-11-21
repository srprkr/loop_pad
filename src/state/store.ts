// Single source of app state.
//
// Settings (volume, mute, tempo, metronome), the kit (three pad sets), the view state and the
// recorded loop are saved in localStorage, so a reload comes back where you left off. The audio
// engine runs the transport; the UI sends it commands and draws its telemetry.

import { create } from "zustand";
import { createAudioEngine } from "../audio/engine";
import type { GridSize, KitState, PadConfig, Settings, Telemetry, UiState } from "../types";
import { BPM_RANGE, DEFAULT_SETTINGS } from "./defaults";
import { clamp, parseSavedState, readSavedState, writeSavedState } from "./persistence";

//==============================================================================
// Persistence

const initial = parseSavedState(readSavedState());
const engine = createAudioEngine(initial.settings);
engine.setLoop(initial.loop);

let saveTimer: number | undefined;
function scheduleSave() {
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    const { settings, kit, ui } = useAppStore.getState();
    writeSavedState({ settings, kit, ui, loop: engine.getLoop() });
  }, 300);
}
engine.onLoopChange(scheduleSave);

//==============================================================================

interface AppState {
  settings: Settings;
  kit: KitState;
  ui: UiState;

  updateSettings(changes: Partial<Settings>): void;

  setGridSize(size: GridSize): void;
  selectPad(index: number): void;
  updateSelectedPad(changes: Partial<PadConfig>): void;
  toggleInspector(): void;

  /** Plays (and selects) a pad of the current grid. */
  triggerPad(index: number): void;
  /** Auditions the selected pad, optionally with values that haven't reached the store yet. */
  previewSelectedPad(overrides?: Partial<PadConfig>): void;

  record(): void;
  togglePlay(): void;
  unlockAudio(): void;
}

export const useAppStore = create<AppState>((set, get) => {
  const setKit = (kit: KitState) => {
    set({ kit });
    scheduleSave();
  };

  const setUi = (ui: UiState) => {
    set({ ui });
    scheduleSave();
  };

  const selectedIndex = () => {
    const { kit, ui } = get();
    const index = ui.selectedPad[kit.gridSize] ?? 0;
    return Math.min(Math.max(0, index), kit.pads[kit.gridSize].length - 1);
  };

  return {
    settings: initial.settings,
    kit: initial.kit,
    ui: initial.ui,

    updateSettings(changes) {
      const settings = { ...get().settings, ...changes };
      settings.volume = clamp(settings.volume, 0, 1, DEFAULT_SETTINGS.volume);
      settings.bpm = Math.round(clamp(settings.bpm, BPM_RANGE.min, BPM_RANGE.max, DEFAULT_SETTINGS.bpm));
      set({ settings });
      engine.setSettings(settings);
      scheduleSave();
    },

    setGridSize(size) {
      const { kit, ui } = get();
      if (kit.gridSize === size) return;
      setKit({ ...kit, gridSize: size });
      // Switching selects the new set's first pad (source_code.jsx:1087-1091).
      setUi({ ...ui, selectedPad: { ...ui.selectedPad, [size]: 0 } });
    },

    selectPad(index) {
      const { kit, ui } = get();
      if (ui.selectedPad[kit.gridSize] === index) return;
      setUi({ ...ui, selectedPad: { ...ui.selectedPad, [kit.gridSize]: index } });
    },

    updateSelectedPad(changes) {
      const { kit } = get();
      const index = selectedIndex();
      const pads = kit.pads[kit.gridSize].map((p, i) => (i === index ? { ...p, ...changes } : p));
      setKit({ ...kit, pads: { ...kit.pads, [kit.gridSize]: pads } });
    },

    toggleInspector() {
      const { ui } = get();
      setUi({ ...ui, inspectorOpen: !ui.inspectorOpen });
    },

    triggerPad(index) {
      const { kit } = get();
      const pad = kit.pads[kit.gridSize][index];
      if (!pad) return;
      // Sound first, so nothing in the UI update (selection, flash, saving) runs before it.
      engine.triggerPad(pad.soundType, pad.pitchSemitones, pad.volume, pad.key);
      flashPad(pad.id, LIVE_FLASH_MS);
      get().selectPad(index);
    },

    previewSelectedPad(overrides) {
      const { kit } = get();
      const pad = { ...kit.pads[kit.gridSize][selectedIndex()], ...overrides };
      engine.previewSound(pad.soundType, pad.pitchSemitones, pad.volume);
    },

    record: () => engine.record(),
    togglePlay: () => engine.togglePlay(),
    unlockAudio: () => engine.unlock(),
  };
});

/** The selected pad of the current grid. */
export function useSelectedPad(): { pad: PadConfig; index: number } {
  return useAppStore(
    (s) => {
      const pads = s.kit.pads[s.kit.gridSize];
      const index = Math.min(Math.max(0, s.ui.selectedPad[s.kit.gridSize] ?? 0), pads.length - 1);
      return { pad: pads[index], index };
    },
    (a, b) => a.pad === b.pad && a.index === b.index,
  );
}

//==============================================================================
// Pad flashes: 120 ms for hits you play, 90 ms for hits the loop plays (source_code.jsx:890, :989).

export const LIVE_FLASH_MS = 120;
export const LOOP_FLASH_MS = 90;

export const useFlashStore = create<Record<string, true>>(() => ({}));
const flashTimers = new Map<string, number>();

export function flashPad(padId: string, ms: number) {
  window.clearTimeout(flashTimers.get(padId));
  useFlashStore.setState({ [padId]: true });
  flashTimers.set(
    padId,
    window.setTimeout(() => {
      flashTimers.delete(padId);
      useFlashStore.setState((s) => {
        const next = { ...s };
        delete next[padId];
        return next;
      }, true);
    }, ms),
  );
}

//==============================================================================
// Telemetry changes ~30x a second; it lives in its own store so only the components that draw
// it re-render.

export const useTelemetryStore = create<Telemetry>(() => ({
  mode: "idle",
  step: 0,
  recordBeat: 0,
  hits: [],
  loopLength: initial.loop.length,
}));

engine.onTelemetry((t) => {
  // Loop playback flashes the pad with that key, but only if it still plays the same sound
  // (the prototype matched on key alone, which flashed the wrong pad after a grid switch).
  if (t.hits.length > 0) {
    const { kit } = useAppStore.getState();
    for (const hit of t.hits) {
      const pad = kit.pads[kit.gridSize].find((p) => p.key === hit.padKey && p.soundType === hit.soundType);
      if (pad) flashPad(pad.id, LOOP_FLASH_MS);
    }
  }
  useTelemetryStore.setState(t);
});
