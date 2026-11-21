import { memo } from "react";
import type { GridSize, PadConfig } from "../types";
import { gridColumns } from "../data/defaultPads";
import { themeFor } from "../data/themes";
import { useFlashStore, useAppStore } from "../state/store";

// source_code.jsx:1243-1315.

/** `reservedHeight`: space below the grid (EDIT bar, inspector) the square must leave free. */
export function PadGrid({ reservedHeight }: { reservedHeight: number }) {
  const gridSize = useAppStore((s) => s.kit.gridSize);
  const pads = useAppStore((s) => s.kit.pads[s.kit.gridSize]);
  const selected = useAppStore((s) => s.ui.selectedPad[s.kit.gridSize] ?? 0);
  const triggerPad = useAppStore((s) => s.triggerPad);
  const columns = gridColumns(gridSize);

  return (
    // A square as large as the space allows: full width, or smaller while the inspector is open.
    // Sized against the parent's container (App.tsx), so EDIT always sits right under the pads.
    <div
      className="grid shrink-0 gap-3"
      style={{
        width: `min(100cqw, 100cqh - ${reservedHeight}px)`,
        height: `min(100cqw, 100cqh - ${reservedHeight}px)`,
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${columns}, minmax(0, 1fr))`,
      }}
    >
        {pads.map((pad, index) => (
          <Pad key={pad.id} pad={pad} index={index} gridSize={gridSize} isSelected={index === selected} onTrigger={triggerPad} />
        ))}
    </div>
  );
}

interface PadProps {
  pad: PadConfig;
  index: number;
  gridSize: GridSize;
  isSelected: boolean;
  onTrigger(index: number): void;
}

const Pad = memo(function Pad({ pad, index, gridSize, isSelected, onTrigger }: PadProps) {
  const isHit = useFlashStore((s) => s[pad.id] === true);
  const theme = themeFor(pad.colorKey);
  const dense = gridSize === "5x5";

  return (
    <button
      data-pad={pad.key}
      data-hit={isHit || undefined}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        onTrigger(index);
      }}
      className={`group relative flex touch-none flex-col justify-between rounded-xl border shadow-md outline-none transition-all duration-75 active:scale-95 ${
        dense ? "p-2" : "p-3"
      } ${isSelected ? "ring-2 ring-white ring-offset-2 ring-offset-zinc-950" : ""} ${
        isHit
          ? `${theme.activeColor} scale-95 shadow-lg`
          : `bg-zinc-900/90 bg-gradient-to-br ${theme.color} text-zinc-200 hover:border-zinc-400/80 hover:brightness-110`
      }`}
    >
      {/* Key badge. The selection ring is the only selected-pad indicator. */}
      <div className="pointer-events-none flex w-full items-center justify-between">
        <span
          className={`rounded font-mono font-bold ${dense ? "px-1 text-[10px]" : "px-1.5 py-0.5 text-xs"} ${
            isHit ? "bg-black/30 text-white" : "border border-zinc-700/40 bg-zinc-800/90 text-zinc-300"
          }`}
        >
          {pad.key}
        </span>
      </div>

      <div className="pointer-events-none mt-auto w-full text-left">
        <div className={`truncate font-semibold tracking-tight ${dense ? "text-[11px]" : "text-sm"} ${isHit ? "text-black" : "text-zinc-100"}`}>
          {pad.name}
        </div>
        <div className="flex items-center justify-between">
          <span className={`truncate font-mono uppercase tracking-wider ${dense ? "text-[8px]" : "text-[9px]"} ${isHit ? "text-black/70" : "text-zinc-400"}`}>
            {pad.category}
          </span>
          {pad.pitchSemitones !== 0 && (
            <span className={`font-mono text-[8px] ${isHit ? "text-black/80" : "text-zinc-400"}`}>
              {pad.pitchSemitones > 0 ? `+${pad.pitchSemitones}` : pad.pitchSemitones}
            </span>
          )}
        </div>
      </div>
    </button>
  );
});
