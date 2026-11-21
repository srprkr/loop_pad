import { useEffect } from "react";
import { usePluginStore } from "../state/pluginStore";

// Each pad's `key` triggers it (source_code.jsx:1048-1065):
//   3x3  1 2 3 / Q W E / A S D
//   4x4  1 2 3 4 / Q W E R / A S D F / Z X C V
//   5x5  1 2 3 4 5 / Q W E R T / A S D F G / Z X C V B / Y U I O P

function isTypingTarget(target: EventTarget | null) {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement;
}

export function usePadKeyboard() {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey || isTypingTarget(e.target)) return;

      const { kit, triggerPad } = usePluginStore.getState();
      const key = e.key.toUpperCase();
      const index = kit.pads[kit.gridSize].findIndex((p) => p.key.toUpperCase() === key);
      if (index < 0) return;

      e.preventDefault();
      triggerPad(index);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
