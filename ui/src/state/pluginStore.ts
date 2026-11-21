// Single source of UI state, mirrored to the plugin.
//
// Parameters (volume, mute, tempo, metronome) are host-automatable: the UI updates its copy
// immediately and forwards changes; host automation comes back through the "parameters" event.
// The kit (three pad sets) is UI-owned and sent to the plugin whole whenever it changes, so the
// plugin can save it and map MIDI notes to pads. The transport runs in the plugin; the UI only
// sends commands and draws the telemetry.

import { create } from "zustand";
import { pluginApi } from "../bridge/api";
import type { GridSize, KitState, PadConfig, ParameterInfo, Telemetry, UiState } from "../bridge/types";
import { DEFAULT_KIT, DEFAULT_PARAMETERS, DEFAULT_UI_STATE } from "./defaults";
import type { ParamId } from "./parameterIds";

type ParamValues = Record<ParamId, number>;
type ParamInfoMap = Record<ParamId, ParameterInfo>;

interface PluginState {
  ready: boolean;
  params: ParamValues;
  paramInfo: ParamInfoMap;
  kit: KitState;
  ui: UiState;
  productName: string;
  version: string;

  initialise(): Promise<void>;
  setParam(id: ParamId, value: number): void;
  beginGesture(id: ParamId): void;
  endGesture(id: ParamId): void;

  setGridSize(size: GridSize): void;
  selectPad(index: number): void;
  updateSelectedPad(changes: Partial<PadConfig>): void;
  toggleInspector(): void;

  /** Plays (and selects) a pad of the current grid. */
  triggerPad(index: number): void;
  /** Auditions the selected pad, optionally with values that haven't reached the store yet. */
  previewSelectedPad(overrides?: Partial<PadConfig>): void;
}

const toMap = <T,>(list: ParameterInfo[], pick: (p: ParameterInfo) => T) =>
  Object.fromEntries(list.map((p) => [p.id, pick(p)])) as Record<ParamId, T>;

const activeGestures = new Set<ParamId>();
let uiSaveTimer: number | undefined;

/** Fills in anything an older saved kit is missing. */
function normaliseKit(saved: KitState | null): KitState {
  if (!saved || !saved.pads) return DEFAULT_KIT;
  const pads = { ...DEFAULT_KIT.pads };
  for (const size of Object.keys(pads) as GridSize[]) {
    const list = saved.pads[size];
    if (Array.isArray(list) && list.length === DEFAULT_KIT.pads[size].length) pads[size] = list;
  }
  return { gridSize: pads[saved.gridSize] ? saved.gridSize : DEFAULT_KIT.gridSize, pads };
}

export const usePluginStore = create<PluginState>((set, get) => {
  const saveUi = (ui: UiState) => {
    set({ ui });
    window.clearTimeout(uiSaveTimer);
    uiSaveTimer = window.setTimeout(() => void pluginApi.setUiState(ui), 300);
  };

  const saveKit = (kit: KitState) => {
    set({ kit });
    void pluginApi.setKit(kit);
  };

  const selectedIndex = () => {
    const { kit, ui } = get();
    const index = ui.selectedPad[kit.gridSize] ?? 0;
    return Math.min(Math.max(0, index), kit.pads[kit.gridSize].length - 1);
  };

  return {
    ready: false,
    params: toMap(DEFAULT_PARAMETERS, (p) => p.value),
    paramInfo: toMap(DEFAULT_PARAMETERS, (p) => p),
    kit: DEFAULT_KIT,
    ui: DEFAULT_UI_STATE,
    productName: "",
    version: "",

    async initialise() {
      const state = await pluginApi.getInitialState();
      const parameters = state.parameters.length > 0 ? state.parameters : DEFAULT_PARAMETERS;
      const kit = normaliseKit(state.kit);
      set({
        ready: true,
        params: { ...get().params, ...toMap(parameters, (p) => p.value) },
        paramInfo: { ...get().paramInfo, ...toMap(parameters, (p) => p) },
        kit,
        ui: {
          ...DEFAULT_UI_STATE,
          ...(state.uiState ?? {}),
          selectedPad: { ...DEFAULT_UI_STATE.selectedPad, ...(state.uiState?.selectedPad ?? {}) },
        },
        productName: state.productName,
        version: state.version,
      });
      if (!state.kit) void pluginApi.setKit(kit); // first run: give the plugin the default pads
    },

    setParam(id, value) {
      const info = get().paramInfo[id];
      const clamped = info ? Math.min(info.max, Math.max(info.min, value)) : value;
      if (get().params[id] === clamped) return;
      set((s) => ({ params: { ...s.params, [id]: clamped } }));
      void pluginApi.setParameter(id, clamped);
    },

    beginGesture(id) {
      activeGestures.add(id);
      void pluginApi.beginGesture(id);
    },

    endGesture(id) {
      activeGestures.delete(id);
      void pluginApi.endGesture(id);
    },

    setGridSize(size) {
      const { kit, ui } = get();
      if (kit.gridSize === size) return;
      saveKit({ ...kit, gridSize: size });
      // Switching selects the new set's first pad (source_code.jsx:1087-1091).
      saveUi({ ...ui, selectedPad: { ...ui.selectedPad, [size]: 0 } });
    },

    selectPad(index) {
      const { kit, ui } = get();
      if (ui.selectedPad[kit.gridSize] === index) return;
      saveUi({ ...ui, selectedPad: { ...ui.selectedPad, [kit.gridSize]: index } });
    },

    updateSelectedPad(changes) {
      const { kit } = get();
      const index = selectedIndex();
      const pads = kit.pads[kit.gridSize].map((p, i) => (i === index ? { ...p, ...changes } : p));
      saveKit({ ...kit, pads: { ...kit.pads, [kit.gridSize]: pads } });
    },

    toggleInspector() {
      const { ui } = get();
      saveUi({ ...ui, inspectorOpen: !ui.inspectorOpen });
    },

    triggerPad(index) {
      const { kit } = get();
      const pad = kit.pads[kit.gridSize][index];
      if (!pad) return;
      get().selectPad(index);
      flashPad(pad.id, LIVE_FLASH_MS);
      void pluginApi.triggerPad(pad.soundType, pad.pitchSemitones, pad.volume, pad.key);
    },

    previewSelectedPad(overrides) {
      const { kit } = get();
      const pad = { ...kit.pads[kit.gridSize][selectedIndex()], ...overrides };
      void pluginApi.previewSound(pad.soundType, pad.pitchSemitones, pad.volume);
    },
  };
});

/** The selected pad of the current grid. */
export function useSelectedPad(): { pad: PadConfig; index: number } {
  return usePluginStore((s) => {
    const pads = s.kit.pads[s.kit.gridSize];
    const index = Math.min(Math.max(0, s.ui.selectedPad[s.kit.gridSize] ?? 0), pads.length - 1);
    return { pad: pads[index], index };
  }, (a, b) => a.pad === b.pad && a.index === b.index);
}

/** Applies parameter changes that originated in the host (automation, undo). */
export function applyHostParameterChanges(changes: Partial<Record<ParamId, number>>) {
  const filtered = Object.entries(changes).filter(([id]) => !activeGestures.has(id as ParamId));
  if (filtered.length === 0) return;
  usePluginStore.setState((s) => ({ params: { ...s.params, ...Object.fromEntries(filtered) } }));
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
// Telemetry changes 30x a second; it lives in its own store so only the components that draw
// it re-render.

const EMPTY_TELEMETRY: Telemetry = {
  peak: [0, 0],
  mode: "idle",
  step: 0,
  recordBeat: 0,
  bpm: 120,
  hostSynced: false,
  hits: [],
  loopLength: 0,
};

export const useTelemetryStore = create<Telemetry>(() => EMPTY_TELEMETRY);

function applyTelemetry(t: Telemetry) {
  // Loop playback flashes the pad with that key, but only if it still plays the same sound
  // (the prototype matched on key alone, which flashed the wrong pad after a grid switch).
  if (t.hits.length > 0) {
    const { kit } = usePluginStore.getState();
    for (const hit of t.hits) {
      const pad = kit.pads[kit.gridSize].find((p) => p.key === hit.padKey && p.soundType === hit.soundType);
      if (pad) flashPad(pad.id, LOOP_FLASH_MS);
    }
  }
  useTelemetryStore.setState(t);
}

//==============================================================================
/** Subscribes the stores to plugin events. Returns an unsubscribe function. */
export function connectToPlugin(): () => void {
  const unsubscribers = [
    pluginApi.on("parameters", applyHostParameterChanges),
    pluginApi.on("telemetry", applyTelemetry),
    pluginApi.on("stateReplaced", () => void usePluginStore.getState().initialise()),
  ];
  void usePluginStore.getState().initialise();
  return () => unsubscribers.forEach((off) => off());
}
