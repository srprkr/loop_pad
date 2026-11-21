import { expect, type Page } from "@playwright/test";

/** Keeps test Chromium off the speakers (Firefox: media.volume_scale in playwright.config.ts). */
export const MUTED_CHROMIUM_ARGS = ["--mute-audio"];

/** Fails the test on any uncaught page error (e.g. a Web Audio call in the wrong order). */
export function trackPageErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  return () => expect(errors, "page errors").toEqual([]);
}

export async function open(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "EDIT" })).toBeVisible();
}

export const pad = (page: Page, key: string) => page.locator(`[data-pad="${key}"]`);
export const recButton = (page: Page) => page.getByRole("button", { name: /^(REC|COUNT)$/ });
export const playButton = (page: Page) => page.getByRole("button", { name: /^(PLAY|PAUSE)$/ });

/** At 200 BPM a 16th is 75 ms: the count-in is 0.9 s and the 4-bar loop 4.8 s. */
export const FAST_BPM = 200;
export const COUNT_IN_MS = 900;
export const LOOP_MS = 4800;

export async function setBpm(page: Page, bpm: number) {
  const field = page.getByTitle("Tempo (BPM)");
  await field.fill(String(bpm));
  await field.press("Enter");
  await expect(field).toHaveValue(String(bpm));
}

/**
    Waits until a pad flashes. A loop hit lights a pad for only 90 ms, shorter than the gaps
    between expect()'s retries, so this checks on every animation frame inside the page.
*/
export async function expectFlash(page: Page, key: string, timeout: number) {
  await page.waitForFunction((k) => document.querySelector(`[data-pad="${k}"]`)?.getAttribute("data-hit") === "true", key, {
    polling: "raf",
    timeout,
  });
}

/**
    Taps everything the app sends to the speakers into an analyser, so a test can check that
    sound actually comes out. Call before page.goto().
*/
export async function tapAudioOutput(page: Page) {
  await page.addInitScript(() => {
    const connect = AudioNode.prototype.connect as (this: AudioNode, ...args: unknown[]) => unknown;
    AudioNode.prototype.connect = function (this: AudioNode, ...args: unknown[]) {
      if (args[0] instanceof AudioDestinationNode) {
        const analyser = this.context.createAnalyser();
        analyser.fftSize = 2048;
        connect.call(this, analyser);
        (window as unknown as { __analyser: AnalyserNode }).__analyser = analyser;
      }
      return connect.apply(this, args);
    } as typeof AudioNode.prototype.connect;
  });
}

/** Highest level reaching the speakers over the next `ms` milliseconds (0 if no audio yet). */
export async function peakOutput(page: Page, ms = 300) {
  let peak = 0;
  for (const end = Date.now() + ms; Date.now() < end; ) {
    peak = Math.max(
      peak,
      await page.evaluate(() => {
        const analyser = (window as unknown as { __analyser?: AnalyserNode }).__analyser;
        if (!analyser || analyser.context.state !== "running") return 0;
        const data = new Float32Array(analyser.fftSize);
        analyser.getFloatTimeDomainData(data);
        return data.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
      }),
    );
    await page.waitForTimeout(20);
  }
  return peak;
}

/** The recorded loop as saved in localStorage: [soundType, padKey, step] per hit. */
export async function savedLoop(page: Page) {
  await page.waitForTimeout(400); // saving is debounced by 300 ms
  const loop = await page.evaluate(() => JSON.parse(localStorage.getItem("loop-pad:v1") ?? "{}").loop ?? []);
  return (loop as { soundType: string; padKey: string; step: number }[]).map((n) => [n.soundType, n.padKey, n.step]);
}

/**
    Records every sample the app sends to the speakers, so a test can measure each hit. Call
    before page.goto(). hitPeaks() then returns the peak of each hit, split on silence.
*/
export async function recordAudioOutput(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __samples?: number[] };
    const connect = AudioNode.prototype.connect as (this: AudioNode, ...args: unknown[]) => unknown;
    AudioNode.prototype.connect = function (this: AudioNode, ...args: unknown[]) {
      if (args[0] instanceof AudioDestinationNode && !w.__samples) {
        w.__samples = [];
        const recorder = this.context.createScriptProcessor(1024, 1, 1);
        recorder.onaudioprocess = (e) => w.__samples!.push(...e.inputBuffer.getChannelData(0));
        connect.call(this, recorder);
        connect.call(recorder, this.context.destination);
      }
      return connect.apply(this, args);
    } as typeof AudioNode.prototype.connect;
  });
}

/** Peak level (dBFS) of each hit recorded since the last call; hits are separated by > 90 ms of silence. */
export async function hitPeaks(page: Page): Promise<number[]> {
  return page.evaluate(() => {
    const w = window as unknown as { __samples: number[] };
    const samples = w.__samples.splice(0);
    const peaks: number[] = [];
    let peak = 0;
    let quiet = 0;
    for (const v of samples) {
      if (Math.abs(v) > 0.01) {
        peak = Math.max(peak, Math.abs(v));
        quiet = 0;
      } else if (peak && ++quiet > 4000) {
        peaks.push(peak);
        peak = 0;
      }
    }
    if (peak) peaks.push(peak);
    return peaks.map((p) => 20 * Math.log10(p));
  });
}
