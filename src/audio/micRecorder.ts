// Records from the microphone for a pad sound. The mic is only opened when you press Record and is
// released as soon as the recording stops, so the browser's mic indicator goes off.

import { MAX_RECORDING_SEC } from "./sampleEdit";

export interface MicRecording {
  /** Stops early. Recording also stops by itself after MAX_RECORDING_SEC. */
  stop(): void;
  /** The recorded audio (compressed, as the browser's MediaRecorder makes it). */
  result: Promise<Blob>;
}

/** Asks for the mic (the browser shows its permission prompt the first time) and starts recording. */
export async function startMicRecording(): Promise<MicRecording> {
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
    throw new Error("This browser can't record audio here (it needs https or localhost).");
  }
  const stream = await navigator.mediaDevices.getUserMedia({
    // Voice-call processing would squash and gate drum sounds.
    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
  });
  const recorder = new MediaRecorder(stream);
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  const result = new Promise<Blob>((resolve, reject) => {
    recorder.onstop = () => {
      stream.getTracks().forEach((t) => t.stop()); // release the mic
      resolve(new Blob(chunks, { type: recorder.mimeType }));
    };
    recorder.onerror = () => {
      stream.getTracks().forEach((t) => t.stop());
      reject(new Error("Recording failed."));
    };
  });

  const stop = () => {
    window.clearTimeout(timer);
    if (recorder.state !== "inactive") recorder.stop();
  };
  const timer = window.setTimeout(stop, MAX_RECORDING_SEC * 1000);
  recorder.start();
  return { stop, result };
}
