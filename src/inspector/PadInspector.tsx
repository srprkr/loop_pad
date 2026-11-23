import { useEffect, useRef, useState } from "react";
import { ChevronDown, Disc, Mic, Palette, Sliders, Square } from "lucide-react";
import { startMicRecording, type MicRecording } from "../audio/micRecorder";
import { MAX_RECORDING_SEC, prepareRecording } from "../audio/sampleEdit";
import { Slider } from "../components/Slider";
import { KIT_SOUNDS, MAX_SOUND_NAME, PAD_VOLUME_RANGE, PITCH_RANGE } from "../data/kit";
import { COLOR_THEMES, THEME_KEYS, themeFor } from "../data/themes";
import { useAppStore, useSelectedPad } from "../state/store";

// refs/source_code.jsx:1332-1487. Shown while EDIT is on; edits the selected pad of the current grid.

export function PadInspector() {
  const { pad } = useSelectedPad();

  return (
    <div className="flex shrink-0 flex-col gap-4 rounded-xl border border-zinc-800 bg-zinc-950/90 p-4">
      <div className="flex items-center gap-2 border-b border-zinc-800/80 pb-2.5">
        <Sliders className="h-4 w-4 text-indigo-400" />
        <span className="text-xs font-semibold uppercase tracking-wider text-zinc-200">
          Pad Inspector: <span className="font-mono text-indigo-400">[{pad.key}] {pad.name}</span>
        </span>
      </div>

      <div className="grid grid-cols-3 items-center gap-6">
        <PadFaders />
        <SampleSelect />
        <ColorPalette />
      </div>
    </div>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`flex h-40 rounded-xl border border-zinc-800/60 bg-zinc-900/60 ${className}`}>{children}</div>;
}

/** Volume ticks every 25%, up to the 130% maximum. */
const volumeMarks = [0, 0.25, 0.5, 0.75, 1, PAD_VOLUME_RANGE.max];

function PadFaders() {
  const { pad } = useSelectedPad();
  const update = useAppStore((s) => s.updateSelectedPad);
  const preview = useAppStore((s) => s.previewSelectedPad);

  // Releasing a fader auditions the pad; double-click resets and auditions (refs/source_code.jsx:1348-1423).
  const pitch = pad.pitchSemitones;
  return (
    <Card className="items-center justify-around p-3">
      <Fader
        label="Pitch"
        readout={`${pitch > 0 ? `+${pitch}` : pitch} st`}
        value={pitch}
        {...PITCH_RANGE}
        marks={[-12, -6, 0, 6, 12]}
        detent={0}
        resetTitle="Double-click or double-tap to reset (0 st)"
        onChange={(v) => update({ pitchSemitones: v })}
        onEnd={(v) => preview({ pitchSemitones: v })}
        onReset={() => {
          update({ pitchSemitones: 0 });
          preview({ pitchSemitones: 0 });
        }}
      />
      <Fader
        label="Volume"
        readout={`${Math.round(pad.volume * 100)}%`}
        value={pad.volume}
        {...PAD_VOLUME_RANGE}
        marks={volumeMarks}
        detent={1}
        resetTitle="Double-click or double-tap to reset (100%)"
        onChange={(v) => update({ volume: v })}
        onEnd={(v) => preview({ volume: v })}
        onReset={() => {
          update({ volume: 1 });
          preview({ volume: 1 });
        }}
      />
    </Card>
  );
}

interface FaderProps {
  /** Values to draw scale ticks at, and the one drawn brighter (the reset point). */
  marks: number[];
  detent: number;
  label: string;
  readout: string;
  value: number;
  min: number;
  max: number;
  step: number;
  resetTitle: string;
  onChange(value: number): void;
  onEnd(value: number): void;
  onReset(): void;
}

function Fader({ label, readout, value, min, max, step, marks, detent, resetTitle, onChange, onEnd, onReset }: FaderProps) {
  return (
    <div className="group flex h-full flex-col items-center justify-between" title={resetTitle}>
      <button onDoubleClick={onReset} className="font-mono text-[10px] font-semibold text-indigo-400 group-hover:underline">
        {readout}
      </button>
      <Slider
        look="fader"
        orientation="vertical"
        length={88}
        value={value}
        min={min}
        max={max}
        step={step}
        marks={marks}
        detent={detent}
        onChange={onChange}
        onEnd={onEnd}
        onDoubleClick={onReset}
      />
      <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-400">{label}</span>
    </div>
  );
}

function SampleSelect() {
  const { pad } = useSelectedPad();
  const recordings = useAppStore((s) => s.recordings);
  const setSound = useAppStore((s) => s.setSelectedPadSound);
  const recording = recordings.find((r) => r.id === pad.soundType);

  return (
    <Card className="flex-col justify-start gap-2 p-3.5">
      <label className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-zinc-400">
        <Disc className="h-3.5 w-3.5 text-zinc-400" />
        Audio Sample
      </label>
      <div className="relative">
        <select
          value={pad.soundType}
          title="Sound"
          // Choosing a sound renames the pad to it (refs/source_code.jsx:1434-1443).
          onChange={(e) => setSound(e.target.value)}
          className="w-full cursor-pointer appearance-none rounded-lg border border-zinc-700 bg-zinc-900 py-2 pl-2.5 pr-7 text-xs text-zinc-200 focus:border-indigo-500 focus:outline-none"
        >
          <optgroup label="Kit">
            {KIT_SOUNDS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label} ({s.category.toUpperCase()})
              </option>
            ))}
          </optgroup>
          {recordings.length > 0 && (
            <optgroup label="Your recordings">
              {recordings.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} (CUSTOM)
                </option>
              ))}
            </optgroup>
          )}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
      </div>
      <RecordSoundRow>
        {recording ? (
          <SoundNameField id={recording.id} name={recording.name} />
        ) : (
          <p className="truncate font-mono text-[10px] leading-tight text-zinc-500">
            Category: <span className="uppercase text-zinc-300">{pad.category}</span>
          </p>
        )}
      </RecordSoundRow>
    </Card>
  );
}

type MicState = { kind: "idle" } | { kind: "recording"; startedAt: number } | { kind: "processing" } | { kind: "error"; message: string };

/**
 * The mic button, with `children` (the sound's name field or category) beside it. The button
 * records a sound onto the selected pad; press again to stop early. While recording, the
 * elapsed time shows in place of `children`.
 */
function RecordSoundRow({ children }: { children: React.ReactNode }) {
  const addRecordingToPad = useAppStore((s) => s.addRecordingToPad);
  const decodeAudio = useAppStore((s) => s.decodeAudio);
  const [state, setState] = useState<MicState>({ kind: "idle" });
  const recorder = useRef<MicRecording | null>(null);
  const [, tick] = useState(0);

  // Redraw the elapsed time while recording.
  useEffect(() => {
    if (state.kind !== "recording") return;
    const timer = window.setInterval(() => tick((n) => n + 1), 100);
    return () => window.clearInterval(timer);
  }, [state.kind]);

  // Clear an error after a few seconds.
  useEffect(() => {
    if (state.kind !== "error") return;
    const timer = window.setTimeout(() => setState({ kind: "idle" }), 5000);
    return () => window.clearTimeout(timer);
  }, [state]);

  // Stop (and release the mic) if the inspector closes mid-recording.
  useEffect(() => () => recorder.current?.stop(), []);

  const start = async () => {
    // The recording goes to the pad selected now, even if another pad is played meanwhile.
    const { kit, ui } = useAppStore.getState();
    const target = { grid: kit.gridSize, index: ui.selectedPad[kit.gridSize] ?? 0 };
    try {
      const rec = await startMicRecording();
      recorder.current = rec;
      setState({ kind: "recording", startedAt: performance.now() });
      const blob = await rec.result;
      recorder.current = null;
      setState({ kind: "processing" });
      const { channels, sampleRate } = await decodeAudio(blob);
      const samples = prepareRecording(channels, sampleRate);
      if (!samples) {
        setState({ kind: "error", message: "Didn't hear anything. Try again, closer to the mic." });
        return;
      }
      addRecordingToPad(target, samples, sampleRate);
      setState({ kind: "idle" });
    } catch (e) {
      recorder.current = null;
      setState({ kind: "error", message: micErrorMessage(e) });
    }
  };

  const recording = state.kind === "recording";
  const processing = state.kind === "processing";
  const label = recording ? "Stop recording" : processing ? "Processing recording" : "Record sound";
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <div className="group/mic relative shrink-0">
          <button
            onClick={() => (recording ? recorder.current?.stop() : !processing && void start())}
            disabled={processing}
            aria-label={label}
            className={`flex h-6 w-6 items-center justify-center rounded-md border transition-colors ${
              recording
                ? "animate-pulse border-rose-500 bg-rose-600 text-white"
                : "border-zinc-700 bg-zinc-800 text-rose-400 hover:bg-zinc-700 disabled:opacity-60"
            }`}
          >
            {recording ? <Square className="h-2.5 w-2.5 fill-current" /> : <Mic className="h-3.5 w-3.5" />}
          </button>
          {/* Tooltip: shows at once on hover (a title attribute takes a second or so). */}
          <span
            role="tooltip"
            className="pointer-events-none absolute left-0 top-full z-10 mt-1.5 whitespace-nowrap rounded border border-zinc-700 bg-zinc-950 px-1.5 py-0.5 font-mono text-[10px] text-zinc-200 opacity-0 shadow-lg transition-opacity group-hover/mic:opacity-100"
          >
            {recording ? "Stop recording" : processing ? "Processing…" : `Record sound (up to ${MAX_RECORDING_SEC} s)`}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          {recording ? (
            <p className="font-mono text-[10px] text-rose-400">Recording… {((performance.now() - state.startedAt) / 1000).toFixed(1)} s</p>
          ) : processing ? (
            <p className="font-mono text-[10px] text-zinc-400">Processing…</p>
          ) : (
            children
          )}
        </div>
      </div>
      {state.kind === "error" && (
        <p role="alert" className="font-mono text-[10px] leading-tight text-rose-400">
          {state.message}
        </p>
      )}
    </div>
  );
}

function micErrorMessage(e: unknown) {
  const name = e instanceof DOMException ? e.name : "";
  if (name === "NotAllowedError") return "Microphone access is blocked. Allow it in the browser's site settings.";
  if (name === "NotFoundError") return "No microphone found.";
  return e instanceof Error ? e.message : "Recording failed.";
}

/** The recorded sound's name; the pad label follows it. Saved on Enter or leaving the field. */
function SoundNameField({ id, name }: { id: string; name: string }) {
  const rename = useAppStore((s) => s.renameRecording);
  const [text, setText] = useState(name);
  useEffect(() => setText(name), [name]);
  const commit = () => {
    if (text.trim()) rename(id, text);
    else setText(name); // blank: keep the old name
  };

  return (
    <label className="flex items-center gap-1.5 font-mono text-[10px] text-zinc-500">
      Name:
      <input
        value={text}
        maxLength={MAX_SOUND_NAME}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            setText(name);
            setTimeout(() => (e.target as HTMLInputElement).blur());
          }
        }}
        className="min-w-0 flex-1 rounded border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 text-[11px] text-zinc-100 focus:border-indigo-500 focus:outline-none"
      />
    </label>
  );
}

function ColorPalette() {
  const { pad } = useSelectedPad();
  const update = useAppStore((s) => s.updateSelectedPad);

  return (
    <Card className="flex-col justify-start gap-2 p-3.5">
      <label className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-zinc-400">
        <Palette className="h-3.5 w-3.5 text-zinc-400" />
        Pad Color
      </label>
      <div className="grid grid-cols-5 gap-2 pt-1">
        {THEME_KEYS.map((key) => {
          const theme = COLOR_THEMES[key];
          const isCurrent = pad.colorKey === key;
          return (
            <button
              key={key}
              onClick={() => update({ colorKey: key })}
              style={{ backgroundColor: theme.accentHex }}
              className={`h-6 rounded-md transition-all hover:scale-105 ${
                isCurrent ? "scale-105 ring-2 ring-white ring-offset-2 ring-offset-zinc-950" : "opacity-80"
              }`}
              title={theme.name}
            />
          );
        })}
      </div>
      <p className="truncate font-mono text-[10px] text-zinc-500">
        Theme: <span className="text-zinc-300">{themeFor(pad.colorKey).name}</span>
      </p>
    </Card>
  );
}
