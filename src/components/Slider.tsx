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
  /** Double-click, or double-tap on a touch screen (phones don't reliably send dblclick). */
  onDoubleClick?(): void;
  title?: string;
  /** "knob": thin track, round thumb (the top bar's VOL). "fader": a mixer-style fader. */
  look?: "knob" | "fader";
  /** Fader only: values to draw scale ticks at. */
  marks?: number[];
  /** Fader only: the value drawn as the brighter tick (the reset point). */
  detent?: number;
}

const DOUBLE_TAP_MS = 350;

/** Thumb size: along the track, and across it. */
const THUMBS = { knob: { along: 18, across: 18 }, fader: { along: 14, across: 30 } } as const;

/**
    A pointer-driven slider (not <input type=range>, which can't be styled as a vertical fader
    consistently across browsers). Two looks: a thin track with a round knob, or a mixer-style
    fader with a recessed slot, scale ticks and a flat cap.
*/
export function Slider({
  value, min, max, step, orientation, length, onChange, onBegin, onEnd, onDoubleClick, title,
  look = "knob", marks = [], detent,
}: SliderProps) {
  const thumb = THUMBS[look];
  const trackRef = useRef<HTMLDivElement>(null);
  const lastValue = useRef(value);
  const lastTap = useRef(0);
  const vertical = orientation === "vertical";
  const fraction = max > min ? (Math.min(max, Math.max(min, value)) - min) / (max - min) : 0;

  const valueAt = (clientX: number, clientY: number) => {
    const rect = trackRef.current!.getBoundingClientRect();
    // The thumb's centre travels between half a thumb in from each end; map the pointer to that
    // range so the thumb stays under it. rect is in screen pixels (the UI is scaled with a CSS
    // transform), so the thumb size is scaled to match.
    const size = vertical ? rect.height : rect.width;
    const half = (thumb.along / 2) * (size / length);
    const along = vertical ? rect.bottom - clientY : clientX - rect.left;
    const f = (along - half) / (size - 2 * half);
    const raw = min + Math.min(1, Math.max(0, f)) * (max - min);
    const snapped = Math.round(raw / step) * step;
    return Number(Math.min(max, Math.max(min, snapped)).toFixed(4));
  };

  const update = (e: React.PointerEvent) => {
    const v = valueAt(e.clientX, e.clientY);
    lastValue.current = v;
    if (v !== value) onChange(v);
  };

  const fractionOf = (v: number) => (max > min ? (Math.min(max, Math.max(min, v)) - min) / (max - min) : 0);
  // Where along the track a value's thumb starts (its near edge), and its centre.
  const offsetOf = (f: number) => `calc(${f * 100}% - ${(f * thumb.along).toFixed(2)}px)`;
  const centreOf = (f: number) => `calc(${f * 100}% - ${(f * thumb.along - thumb.along / 2).toFixed(2)}px)`;
  const thumbOffset = offsetOf(fraction);

  return (
    <div
      ref={trackRef}
      data-slider
      title={title}
      className="group relative shrink-0 cursor-pointer touch-none"
      style={vertical ? { width: thumb.across, height: length } : { width: length, height: thumb.across }}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        if (e.pointerType !== "mouse" && onDoubleClick) {
          const now = e.timeStamp;
          const isDoubleTap = now - lastTap.current < DOUBLE_TAP_MS;
          lastTap.current = isDoubleTap ? 0 : now;
          if (isDoubleTap) {
            onDoubleClick();
            return;
          }
        }
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
      {look === "knob" ? (
        <>
          <div
            className={`absolute rounded-full bg-zinc-800 ${vertical ? "inset-y-0 left-1/2 w-1.5 -translate-x-1/2" : "inset-x-0 top-1/2 h-1.5 -translate-y-1/2"}`}
          />
          <div
            className="absolute rounded-full border border-zinc-300 bg-zinc-100 shadow-md shadow-black/60 transition-transform group-active:scale-110"
            style={
              vertical
                ? { width: thumb.along, height: thumb.along, left: 0, bottom: thumbOffset }
                : { width: thumb.along, height: thumb.along, top: 0, left: thumbOffset }
            }
          />
        </>
      ) : (
        <FaderParts vertical={vertical} thumb={thumb} thumbOffset={thumbOffset} ticks={marks.map((m) => ({ at: centreOf(fractionOf(m)), detent: m === detent }))} />
      )}
    </div>
  );
}

/** The fader look: scale ticks either side of a recessed slot, and a flat cap with a grip line. */
function FaderParts({
  vertical, thumb, thumbOffset, ticks,
}: {
  vertical: boolean;
  thumb: { along: number; across: number };
  thumbOffset: string;
  ticks: { at: string; detent: boolean }[];
}) {
  // Inset along the track by half the cap, so the slot ends where the cap's centre stops.
  const slotInset = thumb.along / 2;
  return (
    <>
      {ticks.map(({ at, detent }, i) =>
        (["start", "end"] as const).map((side) => (
          <div
            key={`${i}-${side}`}
            className={`absolute ${detent ? "bg-zinc-400" : "bg-zinc-700"}`}
            style={
              vertical
                ? { height: 1, width: detent ? 8 : 5, bottom: at, [side === "start" ? "left" : "right"]: 0 }
                : { width: 1, height: detent ? 8 : 5, left: at, [side === "start" ? "top" : "bottom"]: 0 }
            }
          />
        )),
      )}
      <div
        className="absolute rounded-sm bg-black shadow-[inset_0_1px_2px_rgba(0,0,0,0.9)] ring-1 ring-zinc-800"
        style={
          vertical
            ? { width: 4, top: slotInset, bottom: slotInset, left: "50%", transform: "translateX(-50%)" }
            : { height: 4, left: slotInset, right: slotInset, top: "50%", transform: "translateY(-50%)" }
        }
      />
      <div
        className="absolute flex items-center justify-center rounded-[3px] border border-zinc-500 bg-gradient-to-b from-zinc-300 to-zinc-400 shadow-md shadow-black/70 transition-colors group-active:from-zinc-200 group-active:to-zinc-300"
        style={
          vertical
            ? { width: thumb.across, height: thumb.along, left: 0, bottom: thumbOffset }
            : { width: thumb.along, height: thumb.across, top: 0, left: thumbOffset }
        }
      >
        <div className={vertical ? "h-px w-4/5 bg-zinc-700" : "h-4/5 w-px bg-zinc-700"} />
      </div>
    </>
  );
}
