import { useEffect, useRef, useState } from "react";
import { Circle, Pause, Play, Volume2, VolumeX } from "lucide-react";
import { tapTempo } from "../audio/transport";
import { Slider } from "../components/Slider";
import { GRID_SIZES } from "../data/defaultPads";
import { BPM_RANGE } from "../state/defaults";
import { useAppStore, useTelemetryStore } from "../state/store";

// source_code.jsx:1080-1240. Grid size (left), transport (centre), master volume (right).

export function TopBar() {
  return (
    <div className="flex w-full items-center justify-between gap-3 whitespace-nowrap rounded-xl border border-zinc-800/80 bg-zinc-950/80 px-4 py-2.5">
      <GridSizeToggle />
      <Transport />
      <VolumeControl />
    </div>
  );
}

function GridSizeToggle() {
  const gridSize = useAppStore((s) => s.kit.gridSize);
  const setGridSize = useAppStore((s) => s.setGridSize);

  return (
    <div className="flex shrink-0 items-center rounded-lg border border-zinc-800 bg-zinc-900 p-1">
      {GRID_SIZES.map((size) => (
        <button
          key={size}
          onClick={() => setGridSize(size)}
          className={`rounded-md px-2.5 py-1 font-mono text-xs transition-all ${
            gridSize === size ? "bg-indigo-600 font-semibold text-white shadow-sm" : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          {size}
        </button>
      ))}
    </div>
  );
}

//==============================================================================
function Transport() {
  const mode = useTelemetryStore((s) => s.mode);
  const record = useAppStore((s) => s.record);
  const togglePlay = useAppStore((s) => s.togglePlay);
  const recording = mode === "countIn" || mode === "recording";
  const playing = mode === "playing";

  return (
    <div className="mx-auto flex shrink-0 items-center justify-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/90 px-2.5 py-1">
      <button
        onClick={record}
        className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 font-mono text-xs font-medium transition-all ${
          recording ? "animate-pulse bg-rose-600 text-white" : "bg-zinc-800 text-rose-400 hover:bg-zinc-700"
        }`}
        title="Record 4 measures (with a 3-beat count-in)"
      >
        <Circle className="h-3.5 w-3.5 fill-current" />
        <span>{mode === "countIn" ? "COUNT" : "REC"}</span>
      </button>

      <button
        onClick={togglePlay}
        className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 font-mono text-xs font-medium transition-all ${
          playing ? "bg-emerald-600 text-white" : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
        }`}
        title={playing ? "Pause loop" : "Play loop"}
      >
        {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 fill-current" />}
        <span>{playing ? "PAUSE" : "PLAY"}</span>
      </button>

      <MetronomeButton />
      <TempoControl />
    </div>
  );
}

function MetronomeButton() {
  const enabled = useAppStore((s) => s.settings.metronome);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const recordBeat = useTelemetryStore((s) => s.recordBeat);
  const [flash, setFlash] = useState(false);
  const firstBeat = useRef(recordBeat);

  // Flash green on each metronome beat while recording (source_code.jsx:960-968).
  useEffect(() => {
    if (recordBeat === firstBeat.current) return;
    setFlash(true);
    const timer = window.setTimeout(() => setFlash(false), 110);
    return () => window.clearTimeout(timer);
  }, [recordBeat]);

  return (
    <button
      onClick={() => updateSettings({ metronome: !enabled })}
      className={`rounded-md border p-1.5 transition-all ${
        flash
          ? "scale-105 border-emerald-400 bg-emerald-500 text-black shadow-lg shadow-emerald-500/50"
          : enabled
            ? "border-blue-500 bg-blue-600 text-white hover:bg-blue-500"
            : "border-transparent bg-zinc-800/40 text-zinc-500 opacity-50"
      }`}
      title="Click to toggle metronome audio"
    >
      <svg viewBox="0 0 100 100" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round">
        <path d="M 46 22 C 40 22 36 28 34 38 L 22 74 C 20 80 24 86 32 86 L 68 86 C 74 86 76 80 74 74 L 68 66" />
        <line x1="44" y1="76" x2="78" y2="28" strokeWidth="9" />
        <circle cx="82" cy="22" r="7" fill="currentColor" stroke="none" />
      </svg>
    </button>
  );
}

const clampBpm = (bpm: number) => Math.max(BPM_RANGE.min, Math.min(BPM_RANGE.max, Math.round(bpm)));

function TempoControl() {
  const bpm = useAppStore((s) => s.settings.bpm);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const setBpm = (value: number) => updateSettings({ bpm: clampBpm(value) });

  // Typed text is committed on Enter / blur, so typing "1" on the way to "140" doesn't clamp to 60.
  const [text, setText] = useState(String(bpm));
  const editing = useRef(false);
  useEffect(() => {
    if (!editing.current) setText(String(bpm));
  }, [bpm]);

  const commit = () => {
    editing.current = false;
    const parsed = parseInt(text, 10);
    const next = Number.isFinite(parsed) ? clampBpm(parsed) : bpm;
    setBpm(next);
    setText(String(next));
  };

  // TAP: average the intervals of taps within the last 3 s (source_code.jsx:1187-1203).
  const taps = useRef<number[]>([]);
  const tap = () => {
    const { bpm: tapped, recent } = tapTempo(taps.current, performance.now());
    taps.current = recent;
    if (tapped !== null) setBpm(tapped);
  };

  return (
    <div className="flex items-center gap-1.5 border-l border-zinc-800 pl-1.5">
      <input
        type="number"
        min={BPM_RANGE.min}
        max={BPM_RANGE.max}
        value={text}
        title="Tempo (BPM)"
        onFocus={() => (editing.current = true)}
        onChange={(e) => {
          setText(e.target.value);
          // Spinner arrows and arrow keys change the value in steps of 1; apply those at once.
          const parsed = parseInt(e.target.value, 10);
          if (Math.abs(parsed - bpm) === 1) setBpm(parsed);
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        className="w-14 rounded border border-zinc-700 bg-zinc-800 px-1 py-0.5 text-center font-mono text-xs text-zinc-100 focus:border-indigo-500 focus:outline-none"
      />
      <button
        onClick={tap}
        className="rounded border border-zinc-700 bg-zinc-800 px-2 py-0.5 font-mono text-[10px] font-semibold text-zinc-300 transition-colors hover:bg-zinc-700 active:bg-indigo-600 active:text-white"
        title="Tap rhythmically to set BPM"
      >
        TAP
      </button>
    </div>
  );
}

//==============================================================================
function VolumeControl() {
  const volume = useAppStore((s) => s.settings.volume);
  const muted = useAppStore((s) => s.settings.muted);
  const updateSettings = useAppStore((s) => s.updateSettings);

  return (
    <div className="flex shrink-0 items-center gap-2">
      <button
        onClick={() => updateSettings({ muted: !muted })}
        className="rounded-lg border border-zinc-700/60 bg-zinc-800/80 p-1.5 text-zinc-300 transition-colors hover:bg-zinc-700"
        title={muted ? "Unmute" : "Mute"}
      >
        {muted ? <VolumeX className="h-4 w-4 text-rose-400" /> : <Volume2 className="h-4 w-4 text-zinc-300" />}
      </button>
      <div className="flex w-16 flex-col gap-1">
        <div className="flex justify-between font-mono text-[9px] text-zinc-400">
          <span>VOL</span>
          <span>{muted ? "0%" : `${Math.round(volume * 100)}%`}</span>
        </div>
        <Slider
          orientation="horizontal"
          length={64}
          min={0}
          max={1}
          step={0.01}
          value={muted ? 0 : volume}
          onChange={(v) => updateSettings({ volume: v, muted: false })} // moving the slider unmutes
        />
      </div>
    </div>
  );
}
