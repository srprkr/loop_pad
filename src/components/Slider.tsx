import { useRef } from "react";

interface SliderProps {
  value: number;
  min: number;
  max: number;
  step: number;
  orientation: "horizontal" | "vertical";
  /** Track length in px. */
  length: number;
  onChange(value: number): void;
  onBegin?(): void;
  /** Called when the drag ends, with the final value. */
  onEnd?(value: number): void;
  onDoubleClick?(): void;
  title?: string;
}

const THUMB = 18;

/**
    A slider with a thin dark track and a white round thumb (the mockup's VOL and inspector
    faders). Pointer-driven rather than a rotated <input type=range>, which plugin web views
    render inconsistently.
*/
export function Slider({ value, min, max, step, orientation, length, onChange, onBegin, onEnd, onDoubleClick, title }: SliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const lastValue = useRef(value);
  const vertical = orientation === "vertical";
  const fraction = max > min ? (Math.min(max, Math.max(min, value)) - min) / (max - min) : 0;

  const valueAt = (clientX: number, clientY: number) => {
    const rect = trackRef.current!.getBoundingClientRect();
    // The UI is scaled with a CSS transform; rect is in screen pixels, so this stays correct.
    const f = vertical ? (rect.bottom - clientY) / rect.height : (clientX - rect.left) / rect.width;
    const raw = min + Math.min(1, Math.max(0, f)) * (max - min);
    const snapped = Math.round(raw / step) * step;
    return Number(Math.min(max, Math.max(min, snapped)).toFixed(4));
  };

  const update = (e: React.PointerEvent) => {
    const v = valueAt(e.clientX, e.clientY);
    lastValue.current = v;
    if (v !== value) onChange(v);
  };

  const thumbOffset = `calc(${fraction * 100}% - ${(fraction * THUMB).toFixed(2)}px)`;

  return (
    <div
      ref={trackRef}
      title={title}
      className="group relative shrink-0 cursor-pointer touch-none"
      style={vertical ? { width: THUMB, height: length } : { width: length, height: THUMB }}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        onBegin?.();
        update(e);
      }}
      onPointerMove={(e) => {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) update(e);
      }}
      onPointerUp={(e) => {
        if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
        e.currentTarget.releasePointerCapture(e.pointerId);
        onEnd?.(lastValue.current);
      }}
      onDoubleClick={onDoubleClick}
    >
      <div
        className={`absolute rounded-full bg-zinc-800 ${vertical ? "inset-y-0 left-1/2 w-1.5 -translate-x-1/2" : "inset-x-0 top-1/2 h-1.5 -translate-y-1/2"}`}
      />
      <div
        className="absolute rounded-full border border-zinc-300 bg-zinc-100 shadow-md shadow-black/60 transition-transform group-active:scale-110"
        style={
          vertical
            ? { width: THUMB, height: THUMB, left: 0, bottom: thumbOffset }
            : { width: THUMB, height: THUMB, top: 0, left: thumbOffset }
        }
      />
    </div>
  );
}
