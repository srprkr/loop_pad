// The built-in kit: 25 synthesized sounds (refs/source_code.jsx:84-121). Sounds recorded with the
// mic are "custom" (see Recording in types.ts).

export type SoundCategory = "kick" | "snare" | "hihat" | "perc" | "tom" | "fx" | "custom";

export interface KitSound {
  id: string;
  label: string;
  category: SoundCategory;
}

export const KIT_SOUNDS: KitSound[] = [
  // Kicks & Sub
  { id: "punch_kick", label: "Punch Kick", category: "kick" },
  { id: "sub_808", label: "Sub 808", category: "kick" },
  { id: "thud_kick", label: "Thud Kick", category: "kick" },
  { id: "click_kick", label: "Click Kick", category: "kick" },

  // Snares & Claps
  { id: "tight_snare", label: "Tight Snare", category: "snare" },
  { id: "fat_snare", label: "Fat Snare", category: "snare" },
  { id: "clap", label: "Clap", category: "snare" },
  { id: "rimshot", label: "Rimshot", category: "snare" },

  // Hi-Hats & Cymbals
  { id: "closed_hat", label: "Closed Hat", category: "hihat" },
  { id: "open_hat", label: "Open Hat", category: "hihat" },
  { id: "pedal_hat", label: "Pedal Hat", category: "hihat" },
  { id: "splash", label: "Splash Cymbal", category: "perc" },
  { id: "crash", label: "Crash Cymbal", category: "perc" },

  // Toms
  { id: "high_tom", label: "High Tom", category: "tom" },
  { id: "mid_tom", label: "Mid Tom", category: "tom" },
  { id: "low_tom", label: "Low Tom", category: "tom" },
  { id: "floor_tom", label: "Floor Tom", category: "tom" },

  // Auxiliary Percussion
  { id: "shaker", label: "Shaker", category: "perc" },
  { id: "tambourine", label: "Tambourine", category: "perc" },
  { id: "cowbell", label: "Cowbell", category: "perc" },
  { id: "woodblock", label: "Woodblock", category: "perc" },
  { id: "agogo", label: "Agogo Bell", category: "perc" },
  { id: "stick_click", label: "Stick Click", category: "perc" },

  // Synthesized FX
  { id: "laser_fx", label: "Laser FX", category: "fx" },
  { id: "noise_drop", label: "Noise Drop FX", category: "fx" },
];

export const findSound = (id: string) => KIT_SOUNDS.find((s) => s.id === id);

/** Recorded sounds' ids start with this, so they can't collide with the kit's. */
export const RECORDING_ID_PREFIX = "rec_";
export const isRecordingId = (id: unknown): id is string => typeof id === "string" && id.startsWith(RECORDING_ID_PREFIX);
/** Longest name for a recorded sound. */
export const MAX_SOUND_NAME = 24;

/** A new recording's name: "Recording 1", "Recording 2", …, one more than the highest in use. */
export function nextRecordingName(recordings: { name: string }[]) {
  const used = recordings.map((r) => /^Recording (\d+)$/.exec(r.name)?.[1]).filter(Boolean).map(Number);
  return `Recording ${Math.max(0, ...used) + 1}`;
}

export const PITCH_RANGE = { min: -12, max: 12, step: 1 } as const;
export const PAD_VOLUME_RANGE = { min: 0, max: 1.3, step: 0.02 } as const;
