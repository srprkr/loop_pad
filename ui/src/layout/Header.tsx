import { ParamKnob } from "../components/ParamKnob";
import { formatPercent } from "../lib/format";
import { OutputMeter } from "./OutputMeter";
import { PresetBrowser } from "./PresetBrowser";
import { usePluginStore } from "../state/pluginStore";

export function Header() {
  const productName = usePluginStore((s) => s.productName);

  return (
    <div className="flex min-h-[64px] items-center justify-between gap-4 border-b border-zinc-800 bg-zinc-900 px-6 py-2">
      <div className="flex shrink-0 items-center justify-start gap-2">
        {/* Product name from CMakeLists.txt. For a logo, add an image under src/assets, import it and render an <img>. */}
        <span className="text-sm font-bold uppercase tracking-[0.2em] text-zinc-100">{productName}</span>
      </div>

      <PresetBrowser />

      <div className="flex items-start gap-3 pt-1">
        <OutputMeter />
        <div className="flex h-16 shrink-0 origin-top scale-90 items-start">
          <ParamKnob param="masterGain" label="Master" step={0.01} format={formatPercent} />
        </div>
      </div>
    </div>
  );
}
