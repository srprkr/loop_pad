import { ChevronDown, Disc, Palette, Sliders } from "lucide-react";
import { Slider } from "../components/Slider";
import { KIT_SOUNDS, PAD_VOLUME_RANGE, PITCH_RANGE, findSound } from "../data/kit";
import { COLOR_THEMES, THEME_KEYS, themeFor } from "../data/themes";
import { useAppStore, useSelectedPad } from "../state/store";

// source_code.jsx:1332-1487. Shown while EDIT is on; edits the selected pad of the current grid.

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

function PadFaders() {
  const { pad } = useSelectedPad();
  const update = useAppStore((s) => s.updateSelectedPad);
  const preview = useAppStore((s) => s.previewSelectedPad);

  // Releasing a fader auditions the pad; double-click resets and auditions (source_code.jsx:1348-1423).
  const pitch = pad.pitchSemitones;
  return (
    <Card className="items-center justify-around p-3">
      <Fader
        label="Pitch"
        readout={`${pitch > 0 ? `+${pitch}` : pitch} st`}
        value={pitch}
        {...PITCH_RANGE}
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

function Fader({ label, readout, value, min, max, step, resetTitle, onChange, onEnd, onReset }: FaderProps) {
  return (
    <div className="group flex h-full flex-col items-center justify-between" title={resetTitle}>
      <button onDoubleClick={onReset} className="font-mono text-[10px] font-semibold text-indigo-400 group-hover:underline">
        {readout}
      </button>
      <Slider orientation="vertical" length={88} value={value} min={min} max={max} step={step} onChange={onChange} onEnd={onEnd} onDoubleClick={onReset} />
      <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-400">{label}</span>
    </div>
  );
}

function SampleSelect() {
  const { pad } = useSelectedPad();
  const update = useAppStore((s) => s.updateSelectedPad);
  const preview = useAppStore((s) => s.previewSelectedPad);

  return (
    <Card className="flex-col justify-center gap-2 p-3.5">
      <label className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-zinc-400">
        <Disc className="h-3.5 w-3.5 text-zinc-400" />
        Audio Sample
      </label>
      <div className="relative">
        <select
          value={pad.soundType}
          onChange={(e) => {
            const sound = findSound(e.target.value);
            if (!sound) return;
            // Choosing a sound renames the pad to it (source_code.jsx:1434-1443).
            update({ soundType: sound.id, name: sound.label, category: sound.category });
            preview({ soundType: sound.id });
          }}
          className="w-full cursor-pointer appearance-none rounded-lg border border-zinc-700 bg-zinc-900 py-2 pl-2.5 pr-7 text-xs text-zinc-200 focus:border-indigo-500 focus:outline-none"
        >
          {KIT_SOUNDS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label} ({s.category.toUpperCase()})
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
      </div>
      <p className="font-mono text-[10px] leading-tight text-zinc-500">
        Category: <span className="uppercase text-zinc-300">{pad.category}</span>
      </p>
    </Card>
  );
}

function ColorPalette() {
  const { pad } = useSelectedPad();
  const update = useAppStore((s) => s.updateSelectedPad);

  return (
    <Card className="flex-col justify-center gap-2 p-3.5">
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
