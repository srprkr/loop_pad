// Typed API to the plugin. Inside the plugin this talks to JUCE; in a normal browser
// (`npm run dev`) it falls back to an in-memory mock with a Web Audio synth, so the UI can be
// developed (and heard) standalone.

import type { InitialState, KitState, Telemetry, UiState } from "./types";
import type { ParamId } from "../state/parameterIds";
import { callNative, isRunningInPlugin, onNativeEvent } from "./juceBackend";
import { createMockBackend } from "./mockBackend";

export interface PluginEvents {
  parameters: Partial<Record<ParamId, number>>;
  telemetry: Telemetry;
  stateReplaced: unknown;
}

export interface Backend {
  call<T>(name: string, ...params: unknown[]): Promise<T>;
  on<K extends keyof PluginEvents>(event: K, fn: (payload: PluginEvents[K]) => void): () => void;
}

const backend: Backend = isRunningInPlugin()
  ? { call: callNative, on: (event, fn) => onNativeEvent(event, fn as (p: unknown) => void) }
  : createMockBackend();

export const pluginApi = {
  isMock: !isRunningInPlugin(),

  getInitialState: () => backend.call<InitialState>("getInitialState"),
  setUiState: (state: UiState) => backend.call<void>("setUiState", state),
  setKit: (kit: KitState) => backend.call<void>("setKit", kit),

  setParameter: (id: ParamId, value: number) => backend.call<void>("setParameter", id, value),
  beginGesture: (id: ParamId) => backend.call<void>("beginGesture", id),
  endGesture: (id: ParamId) => backend.call<void>("endGesture", id),

  /** Plays a pad. While recording, the hit is also quantized into the loop. */
  triggerPad: (soundType: string, pitchSemitones: number, volume: number, padKey: string) =>
    backend.call<void>("triggerPad", soundType, pitchSemitones, volume, padKey),
  /** Plays a sound without recording it (inspector auditions). */
  previewSound: (soundType: string, pitchSemitones: number, volume: number) =>
    backend.call<void>("previewSound", soundType, pitchSemitones, volume),

  /** REC: starts the count-in, or stops if counting in / recording. */
  record: () => backend.call<void>("record"),
  /** PLAY / PAUSE. Playback always starts from step 0. */
  togglePlay: () => backend.call<void>("togglePlay"),
  stop: () => backend.call<void>("stop"),

  on: backend.on,
};
