import { describe, expect, it } from "vitest";
import { DEFAULT_PADS } from "../data/defaultPads";
import { padForLoopHit } from "./padForLoopHit";

describe("which pad a loop hit lights", () => {
  it("lights the pad it was played on while that pad still has the sound", () => {
    expect(padForLoopHit(DEFAULT_PADS["4x4"], { padKey: "Q", soundType: "clap" })?.key).toBe("Q");
  });

  it("follows the sound to its new pad after a grid switch", () => {
    // Recorded on Q in 4x4; in 5x5 the clap is on R (Q is Stick Click).
    expect(padForLoopHit(DEFAULT_PADS["5x5"], { padKey: "Q", soundType: "clap" })?.key).toBe("R");
  });

  it("follows the sound when it was moved to another pad in the inspector", () => {
    const pads = DEFAULT_PADS["4x4"].map((p) =>
      p.key === "Q" ? { ...p, soundType: "cowbell" } : p.key === "A" ? { ...p, soundType: "clap" } : p,
    );
    expect(padForLoopHit(pads, { padKey: "Q", soundType: "clap" })?.key).toBe("A");
  });

  it("prefers the original pad when several pads play the sound", () => {
    const pads = DEFAULT_PADS["4x4"].map((p) => (p.key === "A" ? { ...p, soundType: "clap" } : p));
    expect(padForLoopHit(pads, { padKey: "Q", soundType: "clap" })?.key).toBe("Q");
  });

  it("lights nothing when the sound isn't on this grid", () => {
    // Shaker is in 4x4 and 5x5 but not 3x3.
    expect(padForLoopHit(DEFAULT_PADS["3x3"], { padKey: "3", soundType: "shaker" })).toBeUndefined();
  });
});
