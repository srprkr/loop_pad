import { useEffect, useState } from "react";
import { useAudioUnlock } from "./hooks/useAudioUnlock";
import { usePadKeyboard } from "./hooks/usePadKeyboard";
import { PadInspector } from "./inspector/PadInspector";
import { TopBar } from "./layout/TopBar";
import { PadGrid } from "./pads/PadGrid";
import { useAppStore } from "./state/store";

// The layout is designed at this size and scaled to fit the browser window.
const DESIGN_WIDTH = 720;
const DESIGN_HEIGHT = 1080;

// Space the pad grid leaves below itself: the EDIT bar, and the inspector while it's open (each plus the gap above it).
const EDIT_BAR_HEIGHT = 20 + 30;
const INSPECTOR_HEIGHT = 20 + 242;

/** Scales the fixed-size design to fit the browser window. */
function useWindowScale() {
  const compute = () => Math.min(window.innerWidth / DESIGN_WIDTH, window.innerHeight / DESIGN_HEIGHT);
  const [scale, setScale] = useState(compute);
  useEffect(() => {
    const onResize = () => setScale(compute());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return scale;
}

function EditButton() {
  const open = useAppStore((s) => s.ui.inspectorOpen);
  const toggle = useAppStore((s) => s.toggleInspector);
  return (
    <div className="flex h-[30px] w-full shrink-0 items-center justify-end">
      <button
        onClick={toggle}
        className={`rounded-lg border px-3 py-1 font-mono text-xs font-medium shadow-sm transition-all ${
          open
            ? "border-indigo-500 bg-indigo-600 text-white shadow-indigo-600/30"
            : "border-zinc-700/60 bg-zinc-800/90 text-zinc-300 hover:bg-zinc-700 hover:text-white"
        }`}
        title="Show or hide the Pad Inspector"
      >
        EDIT
      </button>
    </div>
  );
}

export default function App() {
  const scale = useWindowScale();
  usePadKeyboard();
  useAudioUnlock();

  const inspectorOpen = useAppStore((s) => s.ui.inspectorOpen);

  return (
    <div className="flex h-screen w-screen justify-center overflow-hidden bg-zinc-950 font-sans text-zinc-100">
      {/* Scaled from the top, centred horizontally; the outer box takes the scaled size. */}
      <div style={{ width: DESIGN_WIDTH * scale, height: DESIGN_HEIGHT * scale }}>
        <div
          className="relative origin-top-left select-none p-3"
          style={{ width: DESIGN_WIDTH, height: DESIGN_HEIGHT, transform: `scale(${scale})` }}
        >
          {/* Device frame (refs/source_code.jsx:1077) */}
          <div className="flex h-full w-full flex-col gap-5 rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
            <TopBar />
            <div className="flex min-h-0 w-full flex-1 flex-col items-center gap-5 [container-type:size]">
              <PadGrid reservedHeight={inspectorOpen ? EDIT_BAR_HEIGHT + INSPECTOR_HEIGHT : EDIT_BAR_HEIGHT} />
              <EditButton />
              {inspectorOpen && <PadInspector />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
