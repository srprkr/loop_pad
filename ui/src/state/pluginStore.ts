// Single source of UI state, mirrored from the plugin.
//
// Parameters are plain values (Hz, seconds, choice indices, 0/1). The UI updates its copy
// immediately and forwards changes to the plugin; host automation comes back through the
// "parameters" event. While the user drags a control, echoes for that control are ignored so
// the knob doesn't jitter.

import { create } from "zustand";
import { pluginApi } from "../bridge/api";
import type { ParameterInfo, PresetList, SampleSlots, Telemetry, UiState } from "../bridge/types";
import { DEFAULT_PARAMETERS, DEFAULT_UI_STATE } from "./defaults";
import type { ParamId } from "./parameterIds";

type ParamValues = Record<ParamId, number>;
type ParamInfoMap = Record<ParamId, ParameterInfo>;

interface PluginState {
  ready: boolean;
  params: ParamValues;
  paramInfo: ParamInfoMap;
  samples: SampleSlots;
  presets: PresetList;
  ui: UiState;
  productName: string;
  version: string;
  lastError: string | null;

  initialise(): Promise<void>;
  setParam(id: ParamId, value: number): void;
  beginGesture(id: ParamId): void;
  endGesture(id: ParamId): void;
  updateUi(changes: Partial<UiState>): void;
  setPresets(presets: PresetList): void;
  showError(message: string | null): void;
}

const toMap = <T,>(list: ParameterInfo[], pick: (p: ParameterInfo) => T) =>
  Object.fromEntries(list.map((p) => [p.id, pick(p)])) as Record<ParamId, T>;

const activeGestures = new Set<ParamId>();
let uiSaveTimer: number | undefined;

export const usePluginStore = create<PluginState>((set, get) => ({
  ready: false,
  params: toMap(DEFAULT_PARAMETERS, (p) => p.value),
  paramInfo: toMap(DEFAULT_PARAMETERS, (p) => p),
  samples: { main: null },
  presets: { items: [], currentId: "" },
  ui: DEFAULT_UI_STATE,
  productName: "",
  version: "",
  lastError: null,

  async initialise() {
    const state = await pluginApi.getInitialState();
    const parameters = state.parameters.length > 0 ? state.parameters : DEFAULT_PARAMETERS;
    set({
      ready: true,
      params: { ...get().params, ...toMap(parameters, (p) => p.value) },
      paramInfo: { ...get().paramInfo, ...toMap(parameters, (p) => p) },
      samples: state.samples,
      presets: state.presets,
      ui: { ...DEFAULT_UI_STATE, ...(state.uiState ?? {}) },
      productName: state.productName,
      version: state.version,
    });
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

  updateUi(changes) {
    const ui = { ...get().ui, ...changes };
    set({ ui });
    window.clearTimeout(uiSaveTimer);
    uiSaveTimer = window.setTimeout(() => void pluginApi.setUiState(ui), 300);
  },

  setPresets(presets) {
    set({ presets });
  },

  showError(message) {
    set({ lastError: message });
  },
}));

/** Applies parameter changes that originated in the host (automation, presets, undo). */
export function applyHostParameterChanges(changes: Partial<Record<ParamId, number>>) {
  const filtered = Object.entries(changes).filter(([id]) => !activeGestures.has(id as ParamId));
  if (filtered.length === 0) return;
  usePluginStore.setState((s) => ({ params: { ...s.params, ...Object.fromEntries(filtered) } }));
}

//==============================================================================
// Telemetry changes 30x a second; it lives in its own store so only the components that draw
// it re-render (canvases read it imperatively inside requestAnimationFrame).

const EMPTY_TELEMETRY: Telemetry = {
  peak: [0, 0],
  voices: [],
  hostBpm: 120,
};

export const useTelemetryStore = create<Telemetry>(() => EMPTY_TELEMETRY);

//==============================================================================
/** Subscribes the stores to plugin events. Returns an unsubscribe function. */
export function connectToPlugin(): () => void {
  const unsubscribers = [
    pluginApi.on("parameters", applyHostParameterChanges),
    pluginApi.on("telemetry", (t) => useTelemetryStore.setState(t)),
    pluginApi.on("samples", (samples) => usePluginStore.setState({ samples })),
    pluginApi.on("stateReplaced", () => void usePluginStore.getState().initialise()),
  ];
  void usePluginStore.getState().initialise();
  return () => unsubscribers.forEach((off) => off());
}
