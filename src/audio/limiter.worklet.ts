// The limiter's AudioWorklet processor. Bundled separately by Vite (imported with ?worker&url) and
// loaded with audioWorklet.addModule(); the maths is in limiter.ts.

import { LIMITER_PROCESSOR, limitBlock, limiterTiming, newLimiterState } from "./limiter";

// The AudioWorklet global scope; TypeScript's DOM types don't include it.
declare const sampleRate: number;
declare class AudioWorkletProcessor {}
declare function registerProcessor(name: string, processor: new () => AudioWorkletProcessor): void;

class LimiterProcessor extends AudioWorkletProcessor {
  private state = newLimiterState();
  private timing = limiterTiming(sampleRate);

  process(inputs: Float32Array[][], outputs: Float32Array[][]) {
    limitBlock(inputs[0], outputs[0], this.state, this.timing);
    return true; // keep running even while nothing is playing
  }
}

registerProcessor(LIMITER_PROCESSOR, LimiterProcessor);
