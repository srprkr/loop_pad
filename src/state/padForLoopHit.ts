import type { PadConfig, PadHit } from "../types";

/**
 * The pad on the current grid to light up for a hit the loop plays.
 *
 * A loop hit remembers the key it was played on and the sound it played. After a grid switch
 * (or a sound change in the inspector) that key may hold a different sound, while the loop still
 * plays the recorded one. So: the pad it was played on if it still has that sound, otherwise the
 * first pad that plays that sound now, otherwise none (the sound isn't on this grid).
 */
export function padForLoopHit(pads: PadConfig[], hit: PadHit): PadConfig | undefined {
  return (
    pads.find((p) => p.key === hit.padKey && p.soundType === hit.soundType) ??
    pads.find((p) => p.soundType === hit.soundType)
  );
}
