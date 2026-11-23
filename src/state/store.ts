// Single source of app state.
//
// Settings (volume, mute, tempo, metronome), the kit (three pad sets), the view state and the
// recorded loop are saved in localStorage, so a reload comes back where you left off. The audio
// engine runs the transport; the UI sends it commands and draws its telemetry.

import { create } from "zustand";
import { createAudioEngine } from "../audio/engine";
import { MAX_SOUND_NAME, RECORDING_ID_PREFIX, findSound, nextRecordingName } from "../data/kit";
import type { GridSize, KitState, PadConfig, Recording, Settings, Telemetry, UiState } from "../types";
import { BPM_RANGE, DEFAULT_SETTINGS } from "./defaults";
import { padForLoopHit } from "./padForLoopHit";
import { clamp, parseSavedState, readSavedState, writeSavedState } from "./persistence";
import { loadRecordingAudio, saveRecordingAudio } from "./recordingsDb";

//==============================================================================
// Persistence

const initial = parseSavedState(readSavedState());
const engine = createAudioEngine(initial.settings);
engine.setLoop(initial.loop);

// Recorded sounds' audio loads from IndexedDB in the background; they play once it's in.
void loadRecordingAudio().then((stored) => {
  for (const [id, audio] of stored) engine.setCustomSound(id, audio.samples, audio.sampleRate);
});

let saveTimer: number | undefined;
function scheduleSave() {
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    const { settings, kit, ui, recordings } = useAppStore.getState();
    writeSavedState({ settings, kit, ui, loop: engine.getLoop(), recordings });
  }, 300);
}
engine.onLoopChange(scheduleSave);

//==============================================================================

interface AppState {
  settings: Settings;
  kit: KitState;
  ui: UiState;
  /** Sounds recorded with the mic. */
  recordings: Recording[];

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

  /** Adds a recorded sound (mono samples), puts it on the given pad and plays it. */
  addRecordingToPad(pad: PadRef, samples: Float32Array, sampleRate: number): void;
  /** Puts a sound (kit or recorded) on the selected pad, renaming the pad to it, and plays it. */
  setSelectedPadSound(soundId: string): void;
  /** Renames a recorded sound, and every pad that plays it. Blank names are ignored. */
  renameRecording(id: string, name: string): void;
  /** Decodes recorded audio into per-channel samples. */
  decodeAudio(data: Blob): Promise<{ channels: Float32Array[]; sampleRate: number }>;
}

/** A pad by grid and position: a recording goes to the pad that was selected when it started. */
export interface PadRef {
  grid: GridSize;
  index: number;
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
    recordings: initial.recordings,

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
      // Switching selects the new set's first pad (refs/source_code.jsx:1087-1091).
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

    addRecordingToPad({ grid, index }, samples, sampleRate) {
      const id = `${RECORDING_ID_PREFIX}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
      const recording = { id, name: nextRecordingName(get().recordings) };
      engine.setCustomSound(id, samples, sampleRate);
      void saveRecordingAudio(id, { samples, sampleRate });
      set({ recordings: [...get().recordings, recording] });

      const { kit } = get();
      const pads = kit.pads[grid].map((p, i) => (i === index ? { ...p, soundType: id, name: recording.name, category: "custom" as const } : p));
      setKit({ ...kit, pads: { ...kit.pads, [grid]: pads } });
      const pad = pads[index];
      if (pad) engine.previewSound(pad.soundType, pad.pitchSemitones, pad.volume);
    },

    setSelectedPadSound(soundId) {
      const kitSound = findSound(soundId);
      const recording = get().recordings.find((r) => r.id === soundId);
      if (kitSound) get().updateSelectedPad({ soundType: kitSound.id, name: kitSound.label, category: kitSound.category });
      else if (recording) get().updateSelectedPad({ soundType: recording.id, name: recording.name, category: "custom" });
      else return;
      get().previewSelectedPad();
    },

    renameRecording(id, name) {
      const trimmed = name.trim().slice(0, MAX_SOUND_NAME);
      if (!trimmed) return;
      const { recordings, kit } = get();
      set({ recordings: recordings.map((r) => (r.id === id ? { ...r, name: trimmed } : r)) });
      const rename = (list: PadConfig[]) => list.map((p) => (p.soundType === id ? { ...p, name: trimmed } : p));
      setKit({ ...kit, pads: { "3x3": rename(kit.pads["3x3"]), "4x4": rename(kit.pads["4x4"]), "5x5": rename(kit.pads["5x5"]) } });
    },

    decodeAudio: (data) => engine.decodeAudio(data),

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
// Pad flashes: 120 ms for hits you play, 90 ms for hits the loop plays (refs/source_code.jsx:890, :989).

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
  // Loop playback lights the pad that plays that sound on the current grid (padForLoopHit.ts).
  if (t.hits.length > 0) {
    const { kit } = useAppStore.getState();
    for (const hit of t.hits) {
      const pad = padForLoopHit(kit.pads[kit.gridSize], hit);
      if (pad) flashPad(pad.id, LOOP_FLASH_MS);
    }
  }
  useTelemetryStore.setState(t);
});
