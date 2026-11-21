import { useEffect } from "react";
import { useAppStore } from "../state/store";

/**
    Unlocks audio on the gestures browsers accept for starting it. On touch screens a pad plays
    on touch-down, but a touch only counts as permission to start audio when the finger lifts
    (pointerup / touchend), so without this the first tap can be silent, especially on iOS.
    It stays attached so audio also recovers if the system suspends it (calls, backgrounding).
*/
export function useAudioUnlock() {
  useEffect(() => {
    const unlock = () => useAppStore.getState().unlockAudio();
    const events = ["pointerup", "touchend", "click", "keydown"] as const;
    events.forEach((type) => window.addEventListener(type, unlock, { capture: true, passive: true }));
    return () => events.forEach((type) => window.removeEventListener(type, unlock, { capture: true }));
  }, []);
}
