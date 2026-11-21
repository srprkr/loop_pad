// Parameter IDs shared with the plugin (plugin/source/Parameters.h). Keep both lists in sync;
// Parameters.h lists every place a new parameter needs adding.

export const PARAM_IDS = ["masterVolume", "mute", "bpm", "metronome"] as const;

export type ParamId = (typeof PARAM_IDS)[number];

export const BPM_RANGE = { min: 60, max: 200 } as const;
