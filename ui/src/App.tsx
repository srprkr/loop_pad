import { useEffect, useState } from "react";
import { usePadKeyboard } from "./hooks/usePadKeyboard";
import { PadInspector } from "./inspector/PadInspector";
import { TopBar } from "./layout/TopBar";
import { PadGrid } from "./pads/PadGrid";
import { connectToPlugin, usePluginStore } from "./state/pluginStore";

// Must match PluginEditor::designWidth / designHeight; the plugin window keeps this aspect ratio.
const DESIGN_WIDTH = 720;
const DESIGN_HEIGHT = 1080;

// Space the pad grid leaves below itself: the EDIT bar, and the inspector while it's open (each plus the gap above it).
const EDIT_BAR_HEIGHT = 20 + 30;
const INSPECTOR_HEIGHT = 20 + 242;

/** Scales the fixed-size design to fill the (resizable) plugin window. */
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

/** Stops the web view from navigating to files dropped onto it. */
function usePreventStrayDrops() {
  useEffect(() => {
    const prevent = (e: DragEvent) => e.preventDefault();
    window.addEventListener("dragover", prevent);
    window.addEventListener("drop", prevent);
    return () => {
      window.removeEventListener("dragover", prevent);
      window.removeEventListener("drop", prevent);
    };
  }, []);
}

function EditButton() {
  const open = usePluginStore((s) => s.ui.inspectorOpen);
  const toggle = usePluginStore((s) => s.toggleInspector);
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
  useEffect(connectToPlugin, []);
  usePadKeyboard();
  usePreventStrayDrops();

  const ready = usePluginStore((s) => s.ready);
  const inspectorOpen = usePluginStore((s) => s.ui.inspectorOpen);
  const productName = usePluginStore((s) => s.productName);

  useEffect(() => {
    if (productName) document.title = productName;
  }, [productName]);

  return (
    <div className="h-screen w-screen overflow-hidden bg-zinc-950 font-sans text-zinc-100">
      <div
        className="relative origin-top-left select-none p-3"
        style={{ width: DESIGN_WIDTH, height: DESIGN_HEIGHT, transform: `scale(${scale})` }}
      >
        {/* Device frame (source_code.jsx:1077) */}
        <div className="flex h-full w-full flex-col gap-5 rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
          {ready && (
            <>
              <TopBar />
              <div className="flex min-h-0 w-full flex-1 flex-col items-center gap-5 [container-type:size]">
                <PadGrid reservedHeight={inspectorOpen ? EDIT_BAR_HEIGHT + INSPECTOR_HEIGHT : EDIT_BAR_HEIGHT} />
                <EditButton />
                {inspectorOpen && <PadInspector />}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
