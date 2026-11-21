// Default pad layouts for each grid size (refs/source_code.jsx:142-199).

import type { GridSize, PadConfig } from "../types";

const pad = (id: string, name: string, soundType: string, category: PadConfig["category"], colorKey: PadConfig["colorKey"], key: string): PadConfig => ({
  id, name, soundType, category, colorKey, key, pitchSemitones: 0, volume: 1,
});

const DEFAULT_PADS_3X3: PadConfig[] = [
  pad("3-0", "Closed Hat", "closed_hat", "hihat", "amber", "1"),
  pad("3-1", "Open Hat", "open_hat", "hihat", "amber", "2"),
  pad("3-2", "Crash", "crash", "perc", "emerald", "3"),
  pad("3-3", "Clap", "clap", "snare", "rose", "Q"),
  pad("3-4", "Tight Snare", "tight_snare", "snare", "rose", "W"),
  pad("3-5", "Rimshot", "rimshot", "snare", "rose", "E"),
  pad("3-6", "High Tom", "high_tom", "tom", "cyan", "A"),
  pad("3-7", "Sub 808", "sub_808", "kick", "orange", "S"),
  pad("3-8", "Punch Kick", "punch_kick", "kick", "orange", "D"),
];

const DEFAULT_PADS_4X4: PadConfig[] = [
  pad("4-0", "Closed Hat", "closed_hat", "hihat", "amber", "1"),
  pad("4-1", "Open Hat", "open_hat", "hihat", "amber", "2"),
  pad("4-2", "Shaker", "shaker", "perc", "emerald", "3"),
  pad("4-3", "Crash", "crash", "perc", "emerald", "4"),
  pad("4-4", "Clap", "clap", "snare", "rose", "Q"),
  pad("4-5", "Tight Snare", "tight_snare", "snare", "rose", "W"),
  pad("4-6", "Rimshot", "rimshot", "snare", "rose", "E"),
  pad("4-7", "Cowbell", "cowbell", "perc", "purple", "R"),
  pad("4-8", "High Tom", "high_tom", "tom", "cyan", "A"),
  pad("4-9", "Mid Tom", "mid_tom", "tom", "cyan", "S"),
  pad("4-10", "Low Tom", "low_tom", "tom", "cyan", "D"),
  pad("4-11", "Laser FX", "laser_fx", "fx", "fuchsia", "F"),
  pad("4-12", "Punch Kick", "punch_kick", "kick", "orange", "Z"),
  pad("4-13", "Sub 808", "sub_808", "kick", "orange", "X"),
  pad("4-14", "Thud Kick", "thud_kick", "kick", "orange", "C"),
  pad("4-15", "Noise Drop", "noise_drop", "fx", "violet", "V"),
];

const DEFAULT_PADS_5X5: PadConfig[] = [
  pad("5-0", "Closed Hat", "closed_hat", "hihat", "amber", "1"),
  pad("5-1", "Pedal Hat", "pedal_hat", "hihat", "amber", "2"),
  pad("5-2", "Open Hat", "open_hat", "hihat", "amber", "3"),
  pad("5-3", "Splash", "splash", "perc", "emerald", "4"),
  pad("5-4", "Crash", "crash", "perc", "emerald", "5"),
  pad("5-5", "Stick Click", "stick_click", "perc", "rose", "Q"),
  pad("5-6", "Rimshot", "rimshot", "snare", "rose", "W"),
  pad("5-7", "Tight Snare", "tight_snare", "snare", "rose", "E"),
  pad("5-8", "Clap", "clap", "snare", "rose", "R"),
  pad("5-9", "Fat Snare", "fat_snare", "snare", "rose", "T"),
  pad("5-10", "Shaker", "shaker", "perc", "purple", "A"),
  pad("5-11", "Tambourine", "tambourine", "perc", "purple", "S"),
  pad("5-12", "Cowbell", "cowbell", "perc", "purple", "D"),
  pad("5-13", "Woodblock", "woodblock", "perc", "purple", "F"),
  pad("5-14", "Agogo", "agogo", "perc", "purple", "G"),
  pad("5-15", "High Tom", "high_tom", "tom", "cyan", "Z"),
  pad("5-16", "Mid Tom", "mid_tom", "tom", "cyan", "X"),
  pad("5-17", "Low Tom", "low_tom", "tom", "cyan", "C"),
  pad("5-18", "Floor Tom", "floor_tom", "tom", "cyan", "V"),
  pad("5-19", "Laser FX", "laser_fx", "fx", "fuchsia", "B"),
  pad("5-20", "Click Kick", "click_kick", "kick", "orange", "Y"),
  pad("5-21", "Punch Kick", "punch_kick", "kick", "orange", "U"),
  pad("5-22", "Sub 808", "sub_808", "kick", "orange", "I"),
  pad("5-23", "Thud Kick", "thud_kick", "kick", "orange", "O"),
  pad("5-24", "Noise Drop", "noise_drop", "fx", "violet", "P"),
];

export const DEFAULT_PADS: Record<GridSize, PadConfig[]> = {
  "3x3": DEFAULT_PADS_3X3,
  "4x4": DEFAULT_PADS_4X4,
  "5x5": DEFAULT_PADS_5X5,
};

export const GRID_SIZES: GridSize[] = ["3x3", "4x4", "5x5"];

export const gridColumns = (size: GridSize) => (size === "3x3" ? 3 : size === "5x5" ? 5 : 4);
