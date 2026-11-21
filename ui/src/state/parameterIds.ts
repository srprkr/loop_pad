// Parameter IDs shared with the plugin (plugin/source/Parameters.h). Keep both lists in sync;
// Parameters.h lists every place a new parameter needs adding.

export const PARAM_IDS = [
  "masterGain",
  "playbackMode",
  "startPos",
  "endPos",
  "loopStartPos",
  "loopEndPos",
  "loopCrossfade",
  "rootNote",
  "preserveSpeed",
  "tempoSync",
  "sampleBpm",
  "attack",
  "decay",
  "sustain",
  "release",
  "hpfEnabled",
  "hpfCutoff",
  "hpfResonance",
  "hpfSlope",
  "lpfEnabled",
  "lpfCutoff",
  "lpfResonance",
  "lpfSlope",
] as const;

export type ParamId = (typeof PARAM_IDS)[number];

// Choice parameters are stored as indices into these lists.
export const PLAYBACK_MODES = ["oneshot", "loop"] as const;
export const FILTER_SLOPES = [12, 18, 24] as const;

export type PlaybackMode = (typeof PLAYBACK_MODES)[number];
export type FilterSlope = (typeof FILTER_SLOPES)[number];
