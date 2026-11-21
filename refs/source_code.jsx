import React, { useState, useEffect, useRef, useCallback } from "react";
import { Volume2, VolumeX, Sparkles, Music, Sliders, Palette, Disc, X, Play, Pause, Square, Circle } from "lucide-react";

type GridSize = "3x3" | "4x4" | "5x5";

type ColorThemeKey = "amber" | "rose" | "emerald" | "cyan" | "orange" | "purple" | "fuchsia" | "violet" | "blue" | "lime";

interface ColorTheme {
  name: string;
  color: string;
  activeColor: string;
  accentHex: string;
}

const COLOR_THEMES: Record<ColorThemeKey, ColorTheme> = {
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

interface AvailableSample {
  id: string;
  label: string;
  category: "kick" | "snare" | "hihat" | "perc" | "tom" | "fx";
}

const AVAILABLE_SAMPLES: AvailableSample[] = [
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

interface PadConfig {
  id: string;
  name: string;
  category: "kick" | "snare" | "hihat" | "perc" | "tom" | "fx";
  colorKey: ColorThemeKey;
  key: string;
  soundType: string;
  pitchSemitones: number; // -12 to +12 semitones
  volume: number; // 0.0 to 1.3
}

interface RecordedNote {
  step: number; // 0 to 63 (64 sixteenth-note steps in 4 bars of 4/4)
  soundType: string;
  pitchSemitones: number;
  volume: number;
  padKey: string;
}

const DEFAULT_PADS_3X3: PadConfig[] = [
  { id: "3-0", name: "Closed Hat", soundType: "closed_hat", category: "hihat", colorKey: "amber", key: "1", pitchSemitones: 0, volume: 1 },
  { id: "3-1", name: "Open Hat", soundType: "open_hat", category: "hihat", colorKey: "amber", key: "2", pitchSemitones: 0, volume: 1 },
  { id: "3-2", name: "Crash", soundType: "crash", category: "perc", colorKey: "emerald", key: "3", pitchSemitones: 0, volume: 1 },
  { id: "3-3", name: "Clap", soundType: "clap", category: "snare", colorKey: "rose", key: "Q", pitchSemitones: 0, volume: 1 },
  { id: "3-4", name: "Tight Snare", soundType: "tight_snare", category: "snare", colorKey: "rose", key: "W", pitchSemitones: 0, volume: 1 },
  { id: "3-5", name: "Rimshot", soundType: "rimshot", category: "snare", colorKey: "rose", key: "E", pitchSemitones: 0, volume: 1 },
  { id: "3-6", name: "High Tom", soundType: "high_tom", category: "tom", colorKey: "cyan", key: "A", pitchSemitones: 0, volume: 1 },
  { id: "3-7", name: "Sub 808", soundType: "sub_808", category: "kick", colorKey: "orange", key: "S", pitchSemitones: 0, volume: 1 },
  { id: "3-8", name: "Punch Kick", soundType: "punch_kick", category: "kick", colorKey: "orange", key: "D", pitchSemitones: 0, volume: 1 },
];

const DEFAULT_PADS_4X4: PadConfig[] = [
  { id: "4-0", name: "Closed Hat", soundType: "closed_hat", category: "hihat", colorKey: "amber", key: "1", pitchSemitones: 0, volume: 1 },
  { id: "4-1", name: "Open Hat", soundType: "open_hat", category: "hihat", colorKey: "amber", key: "2", pitchSemitones: 0, volume: 1 },
  { id: "4-2", name: "Shaker", soundType: "shaker", category: "perc", colorKey: "emerald", key: "3", pitchSemitones: 0, volume: 1 },
  { id: "4-3", name: "Crash", soundType: "crash", category: "perc", colorKey: "emerald", key: "4", pitchSemitones: 0, volume: 1 },
  { id: "4-4", name: "Clap", soundType: "clap", category: "snare", colorKey: "rose", key: "Q", pitchSemitones: 0, volume: 1 },
  { id: "4-5", name: "Tight Snare", soundType: "tight_snare", category: "snare", colorKey: "rose", key: "W", pitchSemitones: 0, volume: 1 },
  { id: "4-6", name: "Rimshot", soundType: "rimshot", category: "snare", colorKey: "rose", key: "E", pitchSemitones: 0, volume: 1 },
  { id: "4-7", name: "Cowbell", soundType: "cowbell", category: "perc", colorKey: "purple", key: "R", pitchSemitones: 0, volume: 1 },
  { id: "4-8", name: "High Tom", soundType: "high_tom", category: "tom", colorKey: "cyan", key: "A", pitchSemitones: 0, volume: 1 },
  { id: "4-9", name: "Mid Tom", soundType: "mid_tom", category: "tom", colorKey: "cyan", key: "S", pitchSemitones: 0, volume: 1 },
  { id: "4-10", name: "Low Tom", soundType: "low_tom", category: "tom", colorKey: "cyan", key: "D", pitchSemitones: 0, volume: 1 },
  { id: "4-11", name: "Laser FX", soundType: "laser_fx", category: "fx", colorKey: "fuchsia", key: "F", pitchSemitones: 0, volume: 1 },
  { id: "4-12", name: "Punch Kick", soundType: "punch_kick", category: "kick", colorKey: "orange", key: "Z", pitchSemitones: 0, volume: 1 },
  { id: "4-13", name: "Sub 808", soundType: "sub_808", category: "kick", colorKey: "orange", key: "X", pitchSemitones: 0, volume: 1 },
  { id: "4-14", name: "Thud Kick", soundType: "thud_kick", category: "kick", colorKey: "orange", key: "C", pitchSemitones: 0, volume: 1 },
  { id: "4-15", name: "Noise Drop", soundType: "noise_drop", category: "fx", colorKey: "violet", key: "V", pitchSemitones: 0, volume: 1 },
];

const DEFAULT_PADS_5X5: PadConfig[] = [
  { id: "5-0", name: "Closed Hat", soundType: "closed_hat", category: "hihat", colorKey: "amber", key: "1", pitchSemitones: 0, volume: 1 },
  { id: "5-1", name: "Pedal Hat", soundType: "pedal_hat", category: "hihat", colorKey: "amber", key: "2", pitchSemitones: 0, volume: 1 },
  { id: "5-2", name: "Open Hat", soundType: "open_hat", category: "hihat", colorKey: "amber", key: "3", pitchSemitones: 0, volume: 1 },
  { id: "5-3", name: "Splash", soundType: "splash", category: "perc", colorKey: "emerald", key: "4", pitchSemitones: 0, volume: 1 },
  { id: "5-4", name: "Crash", soundType: "crash", category: "perc", colorKey: "emerald", key: "5", pitchSemitones: 0, volume: 1 },
  { id: "5-5", name: "Stick Click", soundType: "stick_click", category: "perc", colorKey: "rose", key: "Q", pitchSemitones: 0, volume: 1 },
  { id: "5-6", name: "Rimshot", soundType: "rimshot", category: "snare", colorKey: "rose", key: "W", pitchSemitones: 0, volume: 1 },
  { id: "5-7", name: "Tight Snare", soundType: "tight_snare", category: "snare", colorKey: "rose", key: "E", pitchSemitones: 0, volume: 1 },
  { id: "5-8", name: "Clap", soundType: "clap", category: "snare", colorKey: "rose", key: "R", pitchSemitones: 0, volume: 1 },
  { id: "5-9", name: "Fat Snare", soundType: "fat_snare", category: "snare", colorKey: "rose", key: "T", pitchSemitones: 0, volume: 1 },
  { id: "5-10", name: "Shaker", soundType: "shaker", category: "perc", colorKey: "purple", key: "A", pitchSemitones: 0, volume: 1 },
  { id: "5-11", name: "Tambourine", soundType: "tambourine", category: "perc", colorKey: "purple", key: "S", pitchSemitones: 0, volume: 1 },
  { id: "5-12", name: "Cowbell", soundType: "cowbell", category: "perc", colorKey: "purple", key: "D", pitchSemitones: 0, volume: 1 },
  { id: "5-13", name: "Woodblock", soundType: "woodblock", category: "perc", colorKey: "purple", key: "F", pitchSemitones: 0, volume: 1 },
  { id: "5-14", name: "Agogo", soundType: "agogo", category: "perc", colorKey: "purple", key: "G", pitchSemitones: 0, volume: 1 },
  { id: "5-15", name: "High Tom", soundType: "high_tom", category: "tom", colorKey: "cyan", key: "Z", pitchSemitones: 0, volume: 1 },
  { id: "5-16", name: "Mid Tom", soundType: "mid_tom", category: "tom", colorKey: "cyan", key: "X", pitchSemitones: 0, volume: 1 },
  { id: "5-17", name: "Low Tom", soundType: "low_tom", category: "tom", colorKey: "cyan", key: "C", pitchSemitones: 0, volume: 1 },
  { id: "5-18", name: "Floor Tom", soundType: "floor_tom", category: "tom", colorKey: "cyan", key: "V", pitchSemitones: 0, volume: 1 },
  { id: "5-19", name: "Laser FX", soundType: "laser_fx", category: "fx", colorKey: "fuchsia", key: "B", pitchSemitones: 0, volume: 1 },
  { id: "5-20", name: "Click Kick", soundType: "click_kick", category: "kick", colorKey: "orange", key: "Y", pitchSemitones: 0, volume: 1 },
  { id: "5-21", name: "Punch Kick", soundType: "punch_kick", category: "kick", colorKey: "orange", key: "U", pitchSemitones: 0, volume: 1 },
  { id: "5-22", name: "Sub 808", soundType: "sub_808", category: "kick", colorKey: "orange", key: "I", pitchSemitones: 0, volume: 1 },
  { id: "5-23", name: "Thud Kick", soundType: "thud_kick", category: "kick", colorKey: "orange", key: "O", pitchSemitones: 0, volume: 1 },
  { id: "5-24", name: "Noise Drop", soundType: "noise_drop", category: "fx", colorKey: "violet", key: "P", pitchSemitones: 0, volume: 1 },
];

export default function DrumPadPlayer() {
  const [gridSize, setGridSize] = useState<GridSize>("4x4");
  const [padsMap, setPadsMap] = useState<Record<GridSize, PadConfig[]>>({
    "3x3": DEFAULT_PADS_3X3,
    "4x4": DEFAULT_PADS_4X4,
    "5x5": DEFAULT_PADS_5X5,
  });

  const [selectedPadId, setSelectedPadId] = useState<string | null>("4-0");
  const [activePad, setActivePad] = useState<string | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState<boolean>(false);
  const [volume, setVolume] = useState<number>(0.85);
  const [isMuted, setIsMuted] = useState<boolean>(false);

  // Recorder, Loop & Metronome states
  const [tempoBpm, setTempoBpm] = useState<number>(120);
  const [isMetronomeEnabled, setIsMetronomeEnabled] = useState<boolean>(true);
  const [transportState, setTransportState] = useState<"idle" | "preroll" | "recording" | "playing">("idle");
  const [metronomeFlash, setMetronomeFlash] = useState<"none" | "green" | "red">("none");
  const [recordedNotes, setRecordedNotes] = useState<RecordedNote[]>([]);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const noiseBufferRef = useRef<AudioBuffer | null>(null);
  const activePadTimeoutRef = useRef<number | null>(null);

  // Playback / Recording timing refs
  const transportStateRef = useRef<"idle" | "preroll" | "recording" | "playing">("idle");
  transportStateRef.current = transportState;

  const tempoBpmRef = useRef<number>(tempoBpm);
  tempoBpmRef.current = tempoBpm;

  const isMetronomeEnabledRef = useRef<boolean>(isMetronomeEnabled);
  isMetronomeEnabledRef.current = isMetronomeEnabled;

  const recordedNotesRef = useRef<RecordedNote[]>([]);
  recordedNotesRef.current = recordedNotes;

  // Tap tempo tracking
  const tapTimesRef = useRef<number[]>([]);

  // Web Audio lookahead scheduling refs
  const nextStepTimeAudioRef = useRef<number>(0);
  const currentStepRef = useRef<number>(0);
  const prerollBeatsLeftRef = useRef<number>(3);
  const nextPrerollBeatTimeRef = useRef<number>(0);

  const pads = padsMap[gridSize];
  const selectedPad = pads.find((p) => p.id === selectedPadId) || pads[0];

  // Initialize Web Audio Context and reusable buffers
  const getAudioContext = useCallback(() => {
    if (!audioCtxRef.current) {
      const AudioCtx = window.AudioContext;
      const ctx = new AudioCtx();
      const master = ctx.createGain();
      master.gain.setValueAtTime(isMuted ? 0 : volume, ctx.currentTime);
      master.connect(ctx.destination);

      // 2 seconds noise buffer
      const bufferSize = ctx.sampleRate * 2;
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }

      audioCtxRef.current = ctx;
      masterGainRef.current = master;
      noiseBufferRef.current = noiseBuffer;
    }

    if (audioCtxRef.current.state === "suspended") {
      audioCtxRef.current.resume();
    }

    return { ctx: audioCtxRef.current, master: masterGainRef.current!, noise: noiseBufferRef.current! };
  }, [isMuted, volume]);

  // Master volume sync
  useEffect(() => {
    if (masterGainRef.current && audioCtxRef.current) {
      const currentVal = isMuted ? 0 : volume;
      masterGainRef.current.gain.setTargetAtTime(currentVal, audioCtxRef.current.currentTime, 0.01);
    }
  }, [volume, isMuted]);

  // Pitch helper: pitch ratio from semitones
  const getPitchMultiplier = (semitones: number) => {
    return Math.pow(2, semitones / 12);
  };

  // Play click tone for metronome scheduled at precise Web Audio time
  const playMetronomeClick = useCallback((time: number, isPreroll: boolean, isAccent: boolean) => {
    try {
      const { ctx, master } = getAudioContext();

      if (isPreroll) {
        // High, hollow woodblock / rim pop click for preroll count-in
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        // Accentuate beat 1 of preroll at 2400Hz, beats 2 and 3 at 2000Hz
        osc.frequency.setValueAtTime(isAccent ? 2400 : 2000, time);
        osc.frequency.exponentialRampToValueAtTime(800, time + 0.02);
        gain.gain.setValueAtTime(0.45, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.025);
        osc.connect(gain);
        gain.connect(master);
        osc.start(time);
        osc.stop(time + 0.03);
      } else {
        // Standard studio click for recording / playback
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(isAccent ? 1600 : 1000, time);
        gain.gain.setValueAtTime(0.35, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.035);
        osc.connect(gain);
        gain.connect(master);
        osc.start(time);
        osc.stop(time + 0.04);
      }
    } catch {
      // AudioContext may be initializing
    }
  }, [getAudioContext]);

  // Synthesize sound scheduled at precise Web Audio time
  const triggerSound = useCallback((soundType: string, pitchSemitones: number = 0, padVol: number = 1.0, scheduledTime?: number) => {
    const { ctx, master, noise } = getAudioContext();
    const t = scheduledTime !== undefined ? Math.max(ctx.currentTime, scheduledTime) : ctx.currentTime;
    const pitch = getPitchMultiplier(pitchSemitones);

    // Dedicated pad gain
    const padGain = ctx.createGain();
    padGain.gain.setValueAtTime(padVol, t);
    padGain.connect(master);

    switch (soundType) {
      case "closed_hat": {
        const source = ctx.createBufferSource();
        source.buffer = noise;
        const filter = ctx.createBiquadFilter();
        filter.type = "highpass";
        filter.frequency.setValueAtTime(Math.min(18000, 7000 * pitch), t);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.7, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06 / Math.max(0.5, pitch));

        source.connect(filter);
        filter.connect(gain);
        gain.connect(padGain);
        source.start(t);
        source.stop(t + 0.08);
        break;
      }

      case "pedal_hat": {
        const source = ctx.createBufferSource();
        source.buffer = noise;
        const filter = ctx.createBiquadFilter();
        filter.type = "highpass";
        filter.frequency.setValueAtTime(Math.min(18000, 5000 * pitch), t);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.5, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12 / Math.max(0.5, pitch));

        source.connect(filter);
        filter.connect(gain);
        gain.connect(padGain);
        source.start(t);
        source.stop(t + 0.14);
        break;
      }

      case "open_hat": {
        const source = ctx.createBufferSource();
        source.buffer = noise;
        const filter = ctx.createBiquadFilter();
        filter.type = "highpass";
        filter.frequency.setValueAtTime(Math.min(18000, 6000 * pitch), t);

        const band = ctx.createBiquadFilter();
        band.type = "bandpass";
        band.frequency.setValueAtTime(Math.min(18000, 8000 * pitch), t);
        band.Q.setValueAtTime(2.0, t);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.65, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.38 / Math.max(0.5, pitch));

        source.connect(filter);
        filter.connect(band);
        band.connect(gain);
        gain.connect(padGain);
        source.start(t);
        source.stop(t + 0.4);
        break;
      }

      case "shaker": {
        const source = ctx.createBufferSource();
        source.buffer = noise;
        const filter = ctx.createBiquadFilter();
        filter.type = "bandpass";
        filter.frequency.setValueAtTime(Math.min(18000, 5500 * pitch), t);
        filter.Q.setValueAtTime(1.5, t);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.01, t);
        gain.gain.linearRampToValueAtTime(0.45, t + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.09 / Math.max(0.5, pitch));

        source.connect(filter);
        filter.connect(gain);
        gain.connect(padGain);
        source.start(t);
        source.stop(t + 0.1);
        break;
      }

      case "splash": {
        const source = ctx.createBufferSource();
        source.buffer = noise;
        const filter = ctx.createBiquadFilter();
        filter.type = "highpass";
        filter.frequency.setValueAtTime(Math.min(18000, 5000 * pitch), t);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.7, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.7);

        source.connect(filter);
        filter.connect(gain);
        gain.connect(padGain);
        source.start(t);
        source.stop(t + 0.75);
        break;
      }

      case "crash": {
        const source = ctx.createBufferSource();
        source.buffer = noise;
        const filter = ctx.createBiquadFilter();
        filter.type = "highpass";
        filter.frequency.setValueAtTime(Math.min(18000, 4500 * pitch), t);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.8, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 1.2);

        source.connect(filter);
        filter.connect(gain);
        gain.connect(padGain);
        source.start(t);
        source.stop(t + 1.25);
        break;
      }

      case "stick_click": {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "square";
        osc.frequency.setValueAtTime(1200 * pitch, t);
        gain.gain.setValueAtTime(0.6, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.015);
        osc.connect(gain);
        gain.connect(padGain);
        osc.start(t);
        osc.stop(t + 0.02);
        break;
      }

      case "clap": {
        const filter = ctx.createBiquadFilter();
        filter.type = "bandpass";
        filter.frequency.setValueAtTime(Math.min(18000, 1100 * pitch), t);
        filter.Q.setValueAtTime(1.8, t);

        const masterClap = ctx.createGain();
        masterClap.connect(padGain);
        filter.connect(masterClap);

        [0, 0.012, 0.024].forEach((offset) => {
          const s = ctx.createBufferSource();
          s.buffer = noise;
          const g = ctx.createGain();
          g.gain.setValueAtTime(0.5, t + offset);
          g.gain.exponentialRampToValueAtTime(0.01, t + offset + 0.015);
          s.connect(g);
          g.connect(filter);
          s.start(t + offset);
          s.stop(t + offset + 0.02);
        });

        const mainS = ctx.createBufferSource();
        mainS.buffer = noise;
        const mainG = ctx.createGain();
        mainG.gain.setValueAtTime(0.8, t + 0.036);
        mainG.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
        mainS.connect(mainG);
        mainG.connect(filter);
        mainS.start(t + 0.036);
        mainS.stop(t + 0.25);
        break;
      }

      case "tight_snare": {
        const osc = ctx.createOscillator();
        const oscGain = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(190 * pitch, t);
        osc.frequency.exponentialRampToValueAtTime(75 * pitch, t + 0.08);
        oscGain.gain.setValueAtTime(0.9, t);
        oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
        osc.connect(oscGain);
        oscGain.connect(padGain);
        osc.start(t);
        osc.stop(t + 0.14);

        const noiseSrc = ctx.createBufferSource();
        noiseSrc.buffer = noise;
        const filter = ctx.createBiquadFilter();
        filter.type = "highpass";
        filter.frequency.setValueAtTime(Math.min(18000, 1500 * pitch), t);
        const noiseGain = ctx.createGain();
        noiseGain.gain.setValueAtTime(0.7, t);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);

        noiseSrc.connect(filter);
        filter.connect(noiseGain);
        noiseGain.connect(padGain);
        noiseSrc.start(t);
        noiseSrc.stop(t + 0.2);
        break;
      }

      case "fat_snare": {
        const osc = ctx.createOscillator();
        const oscGain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(160 * pitch, t);
        osc.frequency.exponentialRampToValueAtTime(65 * pitch, t + 0.12);
        oscGain.gain.setValueAtTime(1.0, t);
        oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
        osc.connect(oscGain);
        oscGain.connect(padGain);
        osc.start(t);
        osc.stop(t + 0.25);

        const noiseSrc = ctx.createBufferSource();
        noiseSrc.buffer = noise;
        const filter = ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(Math.min(18000, 4000 * pitch), t);
        const noiseGain = ctx.createGain();
        noiseGain.gain.setValueAtTime(0.8, t);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.26);

        noiseSrc.connect(filter);
        filter.connect(noiseGain);
        noiseGain.connect(padGain);
        noiseSrc.start(t);
        noiseSrc.stop(t + 0.28);
        break;
      }

      case "rimshot": {
        const osc = ctx.createOscillator();
        const oscGain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(780 * pitch, t);
        osc.frequency.exponentialRampToValueAtTime(420 * pitch, t + 0.03);
        oscGain.gain.setValueAtTime(0.8, t);
        oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.045);
        osc.connect(oscGain);
        oscGain.connect(padGain);
        osc.start(t);
        osc.stop(t + 0.05);

        const click = ctx.createBufferSource();
        click.buffer = noise;
        const clickF = ctx.createBiquadFilter();
        clickF.type = "bandpass";
        clickF.frequency.setValueAtTime(Math.min(18000, 3200 * pitch), t);
        clickF.Q.setValueAtTime(4.0, t);
        const clickG = ctx.createGain();
        clickG.gain.setValueAtTime(0.6, t);
        clickG.gain.exponentialRampToValueAtTime(0.001, t + 0.025);
        click.connect(clickF);
        clickF.connect(clickG);
        clickG.connect(padGain);
        click.start(t);
        click.stop(t + 0.03);
        break;
      }

      case "cowbell": {
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        osc1.type = "square";
        osc2.type = "square";
        osc1.frequency.setValueAtTime(540 * pitch, t);
        osc2.frequency.setValueAtTime(800 * pitch, t);

        const filter = ctx.createBiquadFilter();
        filter.type = "bandpass";
        filter.frequency.setValueAtTime(Math.min(18000, 740 * pitch), t);
        filter.Q.setValueAtTime(3.5, t);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.7, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);

        osc1.connect(filter);
        osc2.connect(filter);
        filter.connect(gain);
        gain.connect(padGain);

        osc1.start(t);
        osc2.start(t);
        osc1.stop(t + 0.38);
        osc2.stop(t + 0.38);
        break;
      }

      case "tambourine": {
        const source = ctx.createBufferSource();
        source.buffer = noise;
        const filter = ctx.createBiquadFilter();
        filter.type = "highpass";
        filter.frequency.setValueAtTime(Math.min(18000, 7500 * pitch), t);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.75, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);

        source.connect(filter);
        filter.connect(gain);
        gain.connect(padGain);
        source.start(t);
        source.stop(t + 0.18);
        break;
      }

      case "woodblock": {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(950 * pitch, t);
        osc.frequency.exponentialRampToValueAtTime(500 * pitch, t + 0.04);
        gain.gain.setValueAtTime(0.8, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
        osc.connect(gain);
        gain.connect(padGain);
        osc.start(t);
        osc.stop(t + 0.07);
        break;
      }

      case "agogo": {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(1150 * pitch, t);
        gain.gain.setValueAtTime(0.75, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
        osc.connect(gain);
        gain.connect(padGain);
        osc.start(t);
        osc.stop(t + 0.22);
        break;
      }

      case "high_tom": {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(240 * pitch, t);
        osc.frequency.exponentialRampToValueAtTime(140 * pitch, t + 0.18);
        gain.gain.setValueAtTime(0.85, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
        osc.connect(gain);
        gain.connect(padGain);
        osc.start(t);
        osc.stop(t + 0.3);
        break;
      }

      case "mid_tom": {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(180 * pitch, t);
        osc.frequency.exponentialRampToValueAtTime(105 * pitch, t + 0.22);
        gain.gain.setValueAtTime(0.85, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
        osc.connect(gain);
        gain.connect(padGain);
        osc.start(t);
        osc.stop(t + 0.35);
        break;
      }

      case "low_tom": {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(130 * pitch, t);
        osc.frequency.exponentialRampToValueAtTime(70 * pitch, t + 0.26);
        gain.gain.setValueAtTime(0.9, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
        osc.connect(gain);
        gain.connect(padGain);
        osc.start(t);
        osc.stop(t + 0.4);
        break;
      }

      case "floor_tom": {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(95 * pitch, t);
        osc.frequency.exponentialRampToValueAtTime(50 * pitch, t + 0.35);
        gain.gain.setValueAtTime(0.95, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
        osc.connect(gain);
        gain.connect(padGain);
        osc.start(t);
        osc.stop(t + 0.5);
        break;
      }

      case "laser_fx": {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(1600 * pitch, t);
        osc.frequency.exponentialRampToValueAtTime(120 * pitch, t + 0.18);
        gain.gain.setValueAtTime(0.65, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
        osc.connect(gain);
        gain.connect(padGain);
        osc.start(t);
        osc.stop(t + 0.25);
        break;
      }

      case "click_kick": {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(220 * pitch, t);
        osc.frequency.exponentialRampToValueAtTime(50 * pitch, t + 0.06);
        gain.gain.setValueAtTime(1.0, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
        osc.connect(gain);
        gain.connect(padGain);
        osc.start(t);
        osc.stop(t + 0.2);
        break;
      }

      case "punch_kick": {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(160 * pitch, t);
        osc.frequency.exponentialRampToValueAtTime(45 * pitch, t + 0.08);
        gain.gain.setValueAtTime(1.0, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
        osc.connect(gain);
        gain.connect(padGain);
        osc.start(t);
        osc.stop(t + 0.26);

        const clickOsc = ctx.createOscillator();
        const clickGain = ctx.createGain();
        clickOsc.type = "square";
        clickOsc.frequency.setValueAtTime(250 * pitch, t);
        clickOsc.frequency.exponentialRampToValueAtTime(40 * pitch, t + 0.02);
        clickGain.gain.setValueAtTime(0.4, t);
        clickGain.gain.exponentialRampToValueAtTime(0.001, t + 0.025);
        clickOsc.connect(clickGain);
        clickGain.connect(padGain);
        clickOsc.start(t);
        clickOsc.stop(t + 0.03);
        break;
      }

      case "sub_808": {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(120 * pitch, t);
        osc.frequency.exponentialRampToValueAtTime(42 * pitch, t + 0.12);
        gain.gain.setValueAtTime(1.0, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.75);
        osc.connect(gain);
        gain.connect(padGain);
        osc.start(t);
        osc.stop(t + 0.8);
        break;
      }

      case "thud_kick": {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(130 * pitch, t);
        osc.frequency.exponentialRampToValueAtTime(38 * pitch, t + 0.14);
        gain.gain.setValueAtTime(1.0, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
        osc.connect(gain);
        gain.connect(padGain);
        osc.start(t);
        osc.stop(t + 0.35);
        break;
      }

      case "noise_drop": {
        const source = ctx.createBufferSource();
        source.buffer = noise;
        const filter = ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(Math.min(18000, 3500 * pitch), t);
        filter.frequency.exponentialRampToValueAtTime(Math.max(20, 100 * pitch), t + 0.45);
        filter.Q.setValueAtTime(4.0, t);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.75, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.48);

        source.connect(filter);
        filter.connect(gain);
        gain.connect(padGain);
        source.start(t);
        source.stop(t + 0.5);
        break;
      }

      default:
        break;
    }
  }, [getAudioContext]);

  // Trigger pad handler (can also be called manually while loop plays)
  const triggerPad = useCallback((pad: PadConfig) => {
    setSelectedPadId(pad.id);
    triggerSound(pad.soundType, pad.pitchSemitones, pad.volume);
    setActivePad(pad.id);

    // If recording, quantize directly to the nearest 16th-note step (0..63)
    if (transportStateRef.current === "recording") {
      const { ctx } = getAudioContext();
      const currentAudioTime = ctx.currentTime;
      const secondsPerBeat = 60 / tempoBpmRef.current;
      const secondsPerStep = secondsPerBeat / 4; // 16th note

      // Find how far we are from nextStepTimeAudioRef
      const timeDiff = currentAudioTime - nextStepTimeAudioRef.current;
      const stepOffset = Math.round(timeDiff / secondsPerStep);
      let targetStep = (currentStepRef.current + stepOffset) % 64;
      if (targetStep < 0) targetStep += 64;

      const newNote: RecordedNote = {
        step: targetStep,
        soundType: pad.soundType,
        pitchSemitones: pad.pitchSemitones,
        volume: pad.volume,
        padKey: pad.key,
      };

      // Add note (or avoid exact duplicate on same step with same sound)
      setRecordedNotes((prev) => {
        const filtered = prev.filter((n) => !(n.step === targetStep && n.soundType === pad.soundType));
        return [...filtered, newNote];
      });
    }

    if (activePadTimeoutRef.current !== null) {
      window.clearTimeout(activePadTimeoutRef.current);
    }
    activePadTimeoutRef.current = window.setTimeout(() => {
      setActivePad(null);
    }, 120);
  }, [triggerSound, getAudioContext]);

  // Pad updates handler
  const updateCurrentPad = useCallback((partial: Partial<PadConfig>) => {
    if (!selectedPad) return;
    setPadsMap((prev) => ({
      ...prev,
      [gridSize]: prev[gridSize].map((p) => {
        if (p.id === selectedPad.id) {
          const updated = { ...p, ...partial };
          return updated;
        }
        return p;
      }),
    }));
  }, [gridSize, selectedPad]);

  // Web Audio lookahead sequencer engine (lookahead scheduling prevents timing drift & quantizes precisely)
  useEffect(() => {
    let animId: number;

    const scheduler = () => {
      const state = transportStateRef.current;
      if (state === "idle") {
        animId = requestAnimationFrame(scheduler);
        return;
      }

      const { ctx } = getAudioContext();
      const currentTime = ctx.currentTime;
      const secondsPerBeat = 60 / tempoBpmRef.current;
      const secondsPerStep = secondsPerBeat / 4; // 16th note step
      const lookahead = 0.1; // look 100ms ahead

      // Handle 3-beat preroll
      if (state === "preroll") {
        while (nextPrerollBeatTimeRef.current < currentTime + lookahead) {
          const beatTime = nextPrerollBeatTimeRef.current;
          const beatsLeft = prerollBeatsLeftRef.current;

          // Preroll click (distinctive high woodblock click)
          if (isMetronomeEnabledRef.current) {
            playMetronomeClick(beatTime, true, beatsLeft === 3);
          }

          prerollBeatsLeftRef.current--;
          nextPrerollBeatTimeRef.current += secondsPerBeat;

          if (prerollBeatsLeftRef.current <= 0) {
            // Preroll complete -> start recording for 16 beats (64 steps) on the downbeat
            transportStateRef.current = "recording";
            setTransportState("recording");
            setRecordedNotes([]);
            currentStepRef.current = 0;
            nextStepTimeAudioRef.current = beatTime + secondsPerBeat;
            break;
          }
        }
      } else if (state === "recording" || state === "playing") {
        // Lookahead schedule 16th-note steps
        while (nextStepTimeAudioRef.current < currentTime + lookahead) {
          const stepTime = nextStepTimeAudioRef.current;
          const step = currentStepRef.current;
          const isQuarterBeat = step % 4 === 0;
          const isDownbeat = step % 16 === 0;

          // Metronome click on quarter beats (each of the 16 beats)
          if (isQuarterBeat) {
            const delayMs = Math.max(0, (stepTime - currentTime) * 1000);
            window.setTimeout(() => {
              if (transportStateRef.current === "recording") {
                // Flash GREEN during actual recording beats
                setMetronomeFlash("green");
                window.setTimeout(() => setMetronomeFlash("none"), 110);
              }
            }, delayMs);

            if (isMetronomeEnabledRef.current) {
              playMetronomeClick(stepTime, false, isDownbeat);
            }
          }

          // If playing (or in playback phase), trigger recorded notes locked to this step
          if (state === "playing") {
            const notes = recordedNotesRef.current;
            for (let i = 0; i < notes.length; i++) {
              const note = notes[i];
              if (note.step === step) {
                triggerSound(note.soundType, note.pitchSemitones, note.volume, stepTime);

                // Flash pad visually in sync
                const delayMs = Math.max(0, (stepTime - currentTime) * 1000);
                window.setTimeout(() => {
                  const matchingPad = pads.find((p) => p.key === note.padKey);
                  if (matchingPad) {
                    setActivePad(matchingPad.id);
                    window.setTimeout(() => setActivePad(null), 90);
                  }
                }, delayMs);
              }
            }
          }

          // Advance step (64 steps = 4 bars of 16th notes)
          const nextStep = (step + 1) % 64;
          currentStepRef.current = nextStep;
          nextStepTimeAudioRef.current += secondsPerStep;

          // If we finished recording step 63, loop seamlessly into playback
          if (state === "recording" && step === 63) {
            transportStateRef.current = "playing";
            setTransportState("playing");
          }
        }
      }

      animId = requestAnimationFrame(scheduler);
    };

    animId = requestAnimationFrame(scheduler);
    return () => cancelAnimationFrame(animId);
  }, [getAudioContext, playMetronomeClick, triggerSound, pads]);

  // Start record flow with 3-beat preroll
  const handleStartRecord = () => {
    const { ctx } = getAudioContext();
    const secondsPerBeat = 60 / tempoBpm;
    prerollBeatsLeftRef.current = 3;
    nextPrerollBeatTimeRef.current = ctx.currentTime + 0.05;

    transportStateRef.current = "preroll";
    setTransportState("preroll");
  };

  // Toggle play/pause
  const handleTogglePlay = () => {
    const { ctx } = getAudioContext();
    if (transportState === "playing") {
      transportStateRef.current = "idle";
      setTransportState("idle");
    } else {
      currentStepRef.current = 0;
      nextStepTimeAudioRef.current = ctx.currentTime + 0.05;
      transportStateRef.current = "playing";
      setTransportState("playing");
    }
  };

  // Stop playback / recording
  const handleStop = () => {
    transportStateRef.current = "idle";
    setTransportState("idle");
    setMetronomeFlash("none");
  };

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      // Do not trigger if user is interacting with an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;

      const key = e.key.toUpperCase();
      const found = pads.find((p) => p.key.toUpperCase() === key);
      if (found) {
        e.preventDefault();
        triggerPad(found);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [pads, triggerPad]);

  const gridColsClass =
    gridSize === "3x3"
      ? "grid-cols-3"
      : gridSize === "5x5"
      ? "grid-cols-5"
      : "grid-cols-4";

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-zinc-950 p-4 md:p-8 text-zinc-100 select-none">
      {/* Device Frame */}
      <div className={`w-full ${gridSize === "5x5" ? "max-w-3xl" : "max-w-2xl"} bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl p-5 md:p-7 flex flex-col gap-5 transition-all duration-200`}>
        
        {/* Header Bar: Layout buttons (far left), Record/Play & Metronome (centered), Master Volume (far right) */}
        <div className="flex items-center justify-between gap-3 bg-zinc-950/80 border border-zinc-800/80 rounded-xl px-4 py-2.5 w-full whitespace-nowrap overflow-x-auto">
          
          {/* 1. Grid Size Toggle (Far left) */}
          <div className="flex items-center shrink-0 bg-zinc-900 border border-zinc-800 rounded-lg p-1">
            {(["3x3", "4x4", "5x5"] as GridSize[]).map((size) => (
              <button
                key={size}
                onClick={() => {
                  setGridSize(size);
                  const targetFirst = padsMap[size][0]?.id;
                  if (targetFirst) setSelectedPadId(targetFirst);
                }}
                className={`px-2.5 py-1 text-xs font-mono rounded-md transition-all ${
                  gridSize === size
                    ? "bg-indigo-600 text-white font-semibold shadow-sm"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {size}
              </button>
            ))}
          </div>

          {/* 2. Record, Play/Pause, Tempo & Metronome Controls (Centered in top middle) */}
          <div className="flex items-center justify-center gap-2 bg-zinc-900/90 border border-zinc-800 rounded-lg px-2.5 py-1 shrink-0 mx-auto">
            {/* Record Button */}
            <button
              onClick={transportState === "recording" || transportState === "preroll" ? handleStop : handleStartRecord}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono font-medium rounded-md transition-all ${
                transportState === "recording" || transportState === "preroll"
                  ? "bg-rose-600 text-white animate-pulse"
                  : "bg-zinc-800 text-rose-400 hover:bg-zinc-700"
              }`}
              title="Record 4 Measures (with 3-beat preroll)"
            >
              <Circle className="w-3.5 h-3.5 fill-current" />
              <span>{transportState === "preroll" ? "COUNT" : transportState === "recording" ? "REC" : "REC"}</span>
            </button>

            {/* Play / Pause Button */}
            <button
              onClick={handleTogglePlay}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono font-medium rounded-md transition-all ${
                transportState === "playing"
                  ? "bg-emerald-600 text-white"
                  : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
              }`}
              title={transportState === "playing" ? "Pause Loop" : "Play Loop"}
            >
              {transportState === "playing" ? (
                <>
                  <Pause className="w-3.5 h-3.5" />
                  <span>PAUSE</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>PLAY</span>
                </>
              )}
            </button>

            {/* Metronome Indicator (icon-only, blue color) */}
            <button
              onClick={() => setIsMetronomeEnabled((m) => !m)}
              className={`p-1.5 rounded-md border transition-all ${
                metronomeFlash === "green"
                  ? "bg-emerald-500 text-black border-emerald-400 shadow-lg shadow-emerald-500/50 scale-105"
                  : metronomeFlash === "red"
                  ? "bg-rose-500 text-white border-rose-400 shadow-lg shadow-rose-500/50 scale-105"
                  : isMetronomeEnabled
                  ? "bg-blue-600 text-white border-blue-500 hover:bg-blue-500"
                  : "bg-zinc-800/40 text-zinc-500 border-transparent opacity-50"
              }`}
              title="Click to toggle metronome audio"
            >
              <svg
                viewBox="0 0 100 100"
                className="w-4 h-4 text-current"
                fill="none"
                stroke="currentColor"
                strokeWidth="10"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {/* Metronome body outline matching uploaded icon */}
                <path d="M 46 22 C 40 22 36 28 34 38 L 22 74 C 20 80 24 86 32 86 L 68 86 C 74 86 76 80 74 74 L 68 66" />
                {/* Swinging arm with bob */}
                <line x1="44" y1="76" x2="78" y2="28" strokeWidth="9" />
                <circle cx="82" cy="22" r="7" fill="currentColor" stroke="none" />
              </svg>
            </button>

            {/* Tempo BPM Number & TAP Tempo */}
            <div className="flex items-center gap-1.5 pl-1.5 border-l border-zinc-800">
              <input
                type="number"
                min="60"
                max="200"
                value={tempoBpm}
                onChange={(e) => {
                  const val = Math.max(60, Math.min(200, parseInt(e.target.value, 10) || 120));
                  setTempoBpm(val);
                }}
                className="w-12 bg-zinc-800 border border-zinc-700 rounded px-1 py-0.5 text-xs font-mono text-center text-zinc-100 focus:outline-none focus:border-indigo-500"
              />
              <button
                onClick={() => {
                  const now = performance.now();
                  const taps = tapTimesRef.current.filter((t) => now - t < 3000); // keep taps within 3s
                  taps.push(now);
                  tapTimesRef.current = taps;

                  if (taps.length >= 2) {
                    const intervals: number[] = [];
                    for (let i = 1; i < taps.length; i++) {
                      intervals.push(taps[i] - taps[i - 1]);
                    }
                    const avgIntervalMs = intervals.reduce((a, b) => a + b, 0) / intervals.length;
                    const calculatedBpm = Math.round(60000 / avgIntervalMs);
                    const clampedBpm = Math.max(60, Math.min(200, calculatedBpm));
                    setTempoBpm(clampedBpm);
                  }
                }}
                className="px-2 py-0.5 text-[10px] font-mono font-semibold bg-zinc-800 hover:bg-zinc-700 active:bg-indigo-600 active:text-white text-zinc-300 border border-zinc-700 rounded transition-colors"
                title="Tap rhythmically to set BPM"
              >
                TAP
              </button>
            </div>
          </div>

          {/* 3. Master Volume Controls (Far right side, locked in the same row) */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setIsMuted((m) => !m)}
              className="p-1.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 border border-zinc-700/60 text-zinc-300 transition-colors"
              title={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-zinc-300" />}
            </button>
            <div className="flex flex-col gap-1 w-16">
              <div className="flex justify-between text-[9px] font-mono text-zinc-400">
                <span>VOL</span>
                <span>{isMuted ? "0%" : `${Math.round(volume * 100)}%`}</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={isMuted ? 0 : volume}
                onChange={(e) => {
                  setVolume(parseFloat(e.target.value));
                  if (isMuted) setIsMuted(false);
                }}
                className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* Dynamic Grid of Drum Pads */}
        <div className={`grid ${gridColsClass} gap-2.5 md:gap-3 aspect-square w-full`}>
          {pads.map((pad) => {
            const isHit = activePad === pad.id;
            const isSelected = selectedPad?.id === pad.id;
            const theme = COLOR_THEMES[pad.colorKey] || COLOR_THEMES.amber;

            return (
              <button
                key={pad.id}
                onPointerDown={(e) => {
                  e.currentTarget.setPointerCapture(e.pointerId);
                  triggerPad(pad);
                }}
                className={`relative group rounded-xl ${
                  gridSize === "5x5" ? "p-2" : "p-3"
                } flex flex-col justify-between transition-all duration-75 border shadow-md active:scale-95 touch-none outline-none ${
                  isSelected ? "ring-2 ring-white ring-offset-2 ring-offset-zinc-950" : ""
                } ${
                  isHit
                    ? `${theme.activeColor} scale-95 shadow-lg`
                    : `bg-gradient-to-br ${theme.color} bg-zinc-900/90 text-zinc-200 hover:border-zinc-400/80 hover:brightness-110`
                }`}
              >
                {/* Top Pad Header: Key and Edit indicator */}
                <div className="flex items-center justify-between w-full pointer-events-none">
                  <span
                    className={`font-mono ${
                      gridSize === "5x5" ? "text-[9px] px-1 py-0.2" : "text-[10px] md:text-xs px-1.5 py-0.5"
                    } font-bold rounded ${
                      isHit
                        ? "bg-black/30 text-white"
                        : "bg-zinc-800/90 text-zinc-300 border border-zinc-700/40"
                    }`}
                  >
                    {pad.key}
                  </span>
                  {isSelected && (
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                  )}
                </div>

                {/* Bottom Pad Label: Sound Name & Category */}
                <div className="text-left pointer-events-none mt-auto">
                  <div
                    className={`${
                      gridSize === "5x5" ? "text-[10px] md:text-[11px]" : "text-xs md:text-sm"
                    } font-semibold tracking-tight truncate ${
                      isHit ? "text-black" : "text-zinc-100"
                    }`}
                  >
                    {pad.name}
                  </div>
                  <div className="flex items-center justify-between">
                    <span
                      className={`${
                        gridSize === "5x5" ? "text-[7px]" : "text-[9px]"
                      } uppercase tracking-wider font-mono truncate ${
                        isHit ? "text-black/70" : "text-zinc-400"
                      }`}
                    >
                      {pad.category}
                    </span>
                    {(pad.pitchSemitones !== 0 || pad.volume !== 1) && (
                      <span className={`text-[8px] font-mono ${isHit ? "text-black/80" : "text-zinc-400"}`}>
                        {pad.pitchSemitones > 0 ? `+${pad.pitchSemitones}` : pad.pitchSemitones !== 0 ? pad.pitchSemitones : ""}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Bottom Bar: EDIT Button on the far right below pads */}
        <div className="flex items-center justify-end w-full">
          <button
            onClick={() => setIsEditorOpen((o) => !o)}
            className={`px-3 py-1 text-xs font-mono font-medium rounded-lg border transition-all shadow-sm ${
              isEditorOpen
                ? "bg-indigo-600 text-white border-indigo-500 shadow-indigo-600/30"
                : "bg-zinc-800/90 text-zinc-300 border-zinc-700/60 hover:bg-zinc-700 hover:text-white"
            }`}
            title="Toggle Pad Editor / Inspector"
          >
            <span>EDIT</span>
          </button>
        </div>

        {/* Selected Pad Customizer Panel (Shown only when EDIT is enabled) */}
        {isEditorOpen && selectedPad && (
          <div className="bg-zinc-950/90 border border-zinc-800 rounded-xl p-4 flex flex-col gap-4 animate-in fade-in duration-150">
            <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2.5">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-indigo-400" />
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-200">
                  Pad Inspector: <span className="text-indigo-400 font-mono">[{selectedPad.key}] {selectedPad.name}</span>
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
              {/* 1. Vertical Sliders (Pitch & Volume) */}
              <div className="flex items-center justify-around bg-zinc-900/60 border border-zinc-800/60 rounded-xl p-3 h-40">
                {/* Vertical Pitch Slider */}
                <div
                  onDoubleClick={() => {
                    updateCurrentPad({ pitchSemitones: 0 });
                    triggerSound(selectedPad.soundType, 0, selectedPad.volume);
                  }}
                  title="Double-click to reset (0 st)"
                  className="flex flex-col items-center justify-between h-full cursor-pointer group"
                >
                  <div className="text-[10px] font-mono text-indigo-400 font-semibold group-hover:underline">
                    {selectedPad.pitchSemitones > 0 ? `+${selectedPad.pitchSemitones}` : selectedPad.pitchSemitones} st
                  </div>
                  <div className="relative flex items-center justify-center h-24 my-1">
                    <input
                      type="range"
                      min="-12"
                      max="12"
                      step="1"
                      value={selectedPad.pitchSemitones}
                      onChange={(e) => {
                        const semitones = parseInt(e.target.value, 10);
                        updateCurrentPad({ pitchSemitones: semitones });
                      }}
                      onPointerUp={() => {
                        triggerSound(selectedPad.soundType, selectedPad.pitchSemitones, selectedPad.volume);
                      }}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        updateCurrentPad({ pitchSemitones: 0 });
                        triggerSound(selectedPad.soundType, 0, selectedPad.volume);
                      }}
                      className="w-24 h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-500 -rotate-90"
                    />
                  </div>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">
                    Pitch
                  </span>
                </div>

                {/* Vertical Pad Volume Slider */}
                <div
                  onDoubleClick={() => {
                    updateCurrentPad({ volume: 1.0 });
                    triggerSound(selectedPad.soundType, selectedPad.pitchSemitones, 1.0);
                  }}
                  title="Double-click to reset (100%)"
                  className="flex flex-col items-center justify-between h-full cursor-pointer group"
                >
                  <div className="text-[10px] font-mono text-indigo-400 font-semibold group-hover:underline">
                    {Math.round(selectedPad.volume * 100)}%
                  </div>
                  <div className="relative flex items-center justify-center h-24 my-1">
                    <input
                      type="range"
                      min="0"
                      max="1.3"
                      step="0.02"
                      value={selectedPad.volume}
                      onChange={(e) => {
                        const vol = parseFloat(e.target.value);
                        updateCurrentPad({ volume: vol });
                      }}
                      onPointerUp={() => {
                        triggerSound(selectedPad.soundType, selectedPad.pitchSemitones, selectedPad.volume);
                      }}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        updateCurrentPad({ volume: 1.0 });
                        triggerSound(selectedPad.soundType, selectedPad.pitchSemitones, 1.0);
                      }}
                      className="w-24 h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-500 -rotate-90"
                    />
                  </div>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">
                    Volume
                  </span>
                </div>
              </div>

              {/* 2. Sample Selection */}
              <div className="flex flex-col justify-center gap-2 bg-zinc-900/60 border border-zinc-800/60 rounded-xl p-3.5 h-40">
                <label className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                  <Disc className="w-3.5 h-3.5 text-zinc-400" />
                  Audio Sample
                </label>
                <select
                  value={selectedPad.soundType}
                  onChange={(e) => {
                    const sample = AVAILABLE_SAMPLES.find((s) => s.id === e.target.value);
                    if (sample) {
                      updateCurrentPad({
                        soundType: sample.id,
                        name: sample.label,
                        category: sample.category,
                      });
                      triggerSound(sample.id, selectedPad.pitchSemitones, selectedPad.volume);
                    }
                  }}
                  className="bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-2 text-xs text-zinc-200 focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  {AVAILABLE_SAMPLES.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label} ({s.category.toUpperCase()})
                    </option>
                  ))}
                </select>
                <p className="text-[10px] font-mono text-zinc-500 leading-tight">
                  Category: <span className="text-zinc-300 uppercase">{selectedPad.category}</span>
                </p>
              </div>

              {/* 3. Color Theme Picker */}
              <div className="flex flex-col justify-center gap-2 bg-zinc-900/60 border border-zinc-800/60 rounded-xl p-3.5 h-40">
                <label className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                  <Palette className="w-3.5 h-3.5 text-zinc-400" />
                  Pad Color
                </label>
                <div className="grid grid-cols-5 gap-2 pt-1">
                  {(Object.keys(COLOR_THEMES) as ColorThemeKey[]).map((cKey) => {
                    const theme = COLOR_THEMES[cKey];
                    const isCurrent = selectedPad.colorKey === cKey;
                    return (
                      <button
                        key={cKey}
                        onClick={() => updateCurrentPad({ colorKey: cKey })}
                        style={{ backgroundColor: theme.accentHex }}
                        className={`h-6 rounded-md transition-all hover:scale-105 ${
                          isCurrent ? "ring-2 ring-white ring-offset-2 ring-offset-zinc-950 scale-105" : "opacity-80"
                        }`}
                        title={theme.name}
                      />
                    );
                  })}
                </div>
                <p className="text-[10px] font-mono text-zinc-500 truncate">
                  Theme: <span className="text-zinc-300">{COLOR_THEMES[selectedPad.colorKey]?.name}</span>
                </p>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
