import { describe, expect, it } from "vitest";
import { isRecordingId, nextRecordingName } from "./kit";

describe("recorded sounds", () => {
  it("are named Recording 1, 2, … after the highest number in use", () => {
    expect(nextRecordingName([])).toBe("Recording 1");
    expect(nextRecordingName([{ name: "Recording 1" }, { name: "Recording 4" }])).toBe("Recording 5");
    expect(nextRecordingName([{ name: "My Snap" }, { name: "Recording 2" }])).toBe("Recording 3");
    expect(nextRecordingName([{ name: "My Snap" }])).toBe("Recording 1"); // renamed ones don't count
  });

  it("have ids that can't be mistaken for kit sounds", () => {
    expect(isRecordingId("rec_lx2k9abc")).toBe(true);
    expect(isRecordingId("clap")).toBe(false);
    expect(isRecordingId(undefined)).toBe(false);
  });
});
