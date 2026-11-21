// Pad colour themes (refs/source_code.jsx:15-76). Class names are written out in full so Tailwind
// finds them when it scans the source; never build them from string fragments.

export type ColorThemeKey =
  | "amber"
  | "rose"
  | "emerald"
  | "cyan"
  | "orange"
  | "purple"
  | "fuchsia"
  | "violet"
  | "blue"
  | "lime";

export interface ColorTheme {
  name: string;
  /** Gradient + border classes for the resting pad. */
  color: string;
  /** Solid classes while the pad flashes. */
  activeColor: string;
  accentHex: string;
}

export const COLOR_THEMES: Record<ColorThemeKey, ColorTheme> = {
  amber: {
    name: "Amber Gold",
    color: "from-amber-600/40 to-yellow-500/20 border-amber-500/40",
    activeColor: "bg-amber-400 text-black shadow-amber-500/50",
    accentHex: "#fbbf24",
  },
  rose: {
    name: "Rose Red",
    color: "from-rose-600/40 to-pink-500/20 border-rose-500/40",
    activeColor: "bg-rose-400 text-black shadow-rose-500/50",
    accentHex: "#f43f5e",
  },
  emerald: {
    name: "Emerald Green",
    color: "from-emerald-600/40 to-teal-500/20 border-emerald-500/40",
    activeColor: "bg-emerald-400 text-black shadow-emerald-500/50",
    accentHex: "#10b981",
  },
  cyan: {
    name: "Cyan Sky",
    color: "from-cyan-600/40 to-blue-500/20 border-cyan-500/40",
    activeColor: "bg-cyan-400 text-black shadow-cyan-500/50",
    accentHex: "#06b6d4",
  },
  orange: {
    name: "Neon Orange",
    color: "from-orange-600/40 to-red-500/20 border-orange-500/40",
    activeColor: "bg-orange-400 text-black shadow-orange-500/50",
    accentHex: "#f97316",
  },
  purple: {
    name: "Deep Purple",
    color: "from-purple-600/40 to-indigo-500/20 border-purple-500/40",
    activeColor: "bg-purple-400 text-black shadow-purple-500/50",
    accentHex: "#a855f7",
  },
  fuchsia: {
    name: "Electric Fuchsia",
    color: "from-fuchsia-600/40 to-pink-500/20 border-fuchsia-500/40",
    activeColor: "bg-fuchsia-400 text-black shadow-fuchsia-500/50",
    accentHex: "#d946ef",
  },
  violet: {
    name: "Violet Indigo",
    color: "from-violet-600/40 to-purple-500/20 border-violet-500/40",
    activeColor: "bg-violet-400 text-black shadow-violet-500/50",
    accentHex: "#8b5cf6",
  },
  blue: {
    name: "Cobalt Blue",
    color: "from-blue-600/40 to-indigo-500/20 border-blue-500/40",
    activeColor: "bg-blue-400 text-black shadow-blue-500/50",
    accentHex: "#3b82f6",
  },
  lime: {
    name: "Volt Lime",
    color: "from-lime-600/40 to-emerald-500/20 border-lime-500/40",
    activeColor: "bg-lime-400 text-black shadow-lime-500/50",
    accentHex: "#84cc16",
  },
};

export const THEME_KEYS = Object.keys(COLOR_THEMES) as ColorThemeKey[];

export const themeFor = (key: string): ColorTheme => COLOR_THEMES[key as ColorThemeKey] ?? COLOR_THEMES.amber;
