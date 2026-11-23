import { describe, expect, it } from "vitest";
import { DEFAULT_PADS } from "../data/defaultPads";
import { DEFAULT_SETTINGS, DEFAULT_UI_STATE } from "./defaults";
import { parseSavedState } from "./persistence";

const valid = {
  settings: { volume: 0.5, muted: true, bpm: 150, metronome: false },
  kit: { gridSize: "5x5", pads: { ...DEFAULT_PADS, "4x4": DEFAULT_PADS["4x4"].map((p, i) => (i === 0 ? { ...p, pitchSemitones: 3 } : p)) } },
  ui: { inspectorOpen: true, selectedPad: { "3x3": 2, "4x4": 5, "5x5": 24 } },
  loop: [{ step: 4, soundType: "clap", pitchSemitones: 2, volume: 0.5, padKey: "Q" }],
};

describe("restoring saved state", () => {
  it("starts with the defaults when nothing is saved", () => {
    const state = parseSavedState(null);
    expect(state.settings).toEqual(DEFAULT_SETTINGS);
    expect(state.kit).toEqual({ gridSize: "4x4", pads: DEFAULT_PADS });
    expect(state.ui).toEqual(DEFAULT_UI_STATE);
    expect(state.loop).toEqual([]);
    expect(state.recordings).toEqual([]);
  });

  it("restores settings, grid, pad edits, view and loop", () => {
    const state = parseSavedState(JSON.stringify(valid));
    expect(state.settings).toEqual(valid.settings);
    expect(state.kit.gridSize).toBe("5x5");
    expect(state.kit.pads["4x4"][0].pitchSemitones).toBe(3);
    expect(state.ui).toEqual(valid.ui);
    expect(state.loop).toEqual(valid.loop);
  });

  it("survives unreadable text", () => {
    expect(parseSavedState("{not json").settings).toEqual(DEFAULT_SETTINGS);
    expect(parseSavedState("null").settings).toEqual(DEFAULT_SETTINGS);
    expect(parseSavedState('"a string"').settings).toEqual(DEFAULT_SETTINGS);
  });

  it("clamps settings into range and replaces wrong types", () => {
    const state = parseSavedState(JSON.stringify({ settings: { volume: 4, muted: "yes", bpm: 999.6, metronome: 1 } }));
    expect(state.settings).toEqual({ volume: 1, muted: false, bpm: 200, metronome: true });
    expect(parseSavedState(JSON.stringify({ settings: { bpm: 10 } })).settings.bpm).toBe(60);
    expect(parseSavedState(JSON.stringify({ settings: { bpm: 133.4 } })).settings.bpm).toBe(133);
  });

  it("falls back to the default pads for an incomplete set or an unknown sound", () => {
    const shortSet = { ...valid.kit, pads: { ...valid.kit.pads, "3x3": DEFAULT_PADS["3x3"].slice(0, 4) } };
    expect(parseSavedState(JSON.stringify({ kit: shortSet })).kit.pads["3x3"]).toEqual(DEFAULT_PADS["3x3"]);

    const unknown = { ...valid.kit, pads: { ...valid.kit.pads, "4x4": DEFAULT_PADS["4x4"].map((p) => ({ ...p, soundType: "gong" })) } };
    expect(parseSavedState(JSON.stringify({ kit: unknown })).kit.pads["4x4"]).toEqual(DEFAULT_PADS["4x4"]);
  });

  it("keeps pads and loop hits that use a recorded sound, while the recording is listed", () => {
    const recordings = [{ id: "rec_abc", name: "Snap" }];
    const pads = { ...DEFAULT_PADS, "4x4": DEFAULT_PADS["4x4"].map((p, i) => (i === 0 ? { ...p, soundType: "rec_abc", name: "Snap", category: "custom" } : p)) };
    const loop = [{ step: 2, soundType: "rec_abc", pitchSemitones: 0, volume: 1, padKey: "1" }];

    const kept = parseSavedState(JSON.stringify({ kit: { gridSize: "4x4", pads }, loop, recordings }));
    expect(kept.recordings).toEqual(recordings);
    expect(kept.kit.pads["4x4"][0].soundType).toBe("rec_abc");
    expect(kept.loop).toEqual(loop);

    const unlisted = parseSavedState(JSON.stringify({ kit: { gridSize: "4x4", pads }, loop }));
    expect(unlisted.kit.pads["4x4"]).toEqual(DEFAULT_PADS["4x4"]);
    expect(unlisted.loop).toEqual([]);
  });

  it("drops malformed recordings and shortens long names", () => {
    const recordings = [{ id: "rec_a", name: "x".repeat(40) }, { id: "clap", name: "Not a recording id" }, { id: "rec_b" }, null];
    expect(parseSavedState(JSON.stringify({ recordings })).recordings).toEqual([{ id: "rec_a", name: "x".repeat(24) }]);
  });

  it("ignores an unknown grid size", () => {
    expect(parseSavedState(JSON.stringify({ kit: { gridSize: "6x6" } })).kit.gridSize).toBe("4x4");
  });

  it("drops loop hits on invalid steps or with unknown sounds", () => {
    const loop = [
      ...valid.loop,
      { step: 64, soundType: "clap", pitchSemitones: 0, volume: 1, padKey: "Q" },
      { step: -1, soundType: "clap", pitchSemitones: 0, volume: 1, padKey: "Q" },
      { step: 2.5, soundType: "clap", pitchSemitones: 0, volume: 1, padKey: "Q" },
      { step: 3, soundType: "gong", pitchSemitones: 0, volume: 1, padKey: "Q" },
      null,
    ];
    expect(parseSavedState(JSON.stringify({ loop })).loop).toEqual(valid.loop);
  });
});
