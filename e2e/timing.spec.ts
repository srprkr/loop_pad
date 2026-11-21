import { expect, test } from "@playwright/test";
import { FAST_BPM, open, recButton, savedLoop, setBpm, trackPageErrors } from "./helpers";

// Runs in Firefox as well as Chromium (see playwright.config.ts).
//
// A player taps along to the clicks they hear, and what they hear is ~40 ms behind the audio
// clock (output + base latency). Hits used to be recorded at the clock time, so a tap right on a
// click was recorded ~40 ms late (55 ms in Firefox, with its tap lead) and often snapped to the
// next 16th. At 200 BPM a 16th is 75 ms, so that lateness lands a step late every time.
test("a tap on the click you hear is recorded on that step", async ({ page }) => {
  const noErrors = trackPageErrors(page);

  // Keep a handle on the app's AudioContext and note every scheduled oscillator start: the first
  // one after REC is the first count-in click.
  await page.addInitScript(() => {
    const w = window as unknown as { __ctx?: AudioContext; __starts: number[] };
    w.__starts = [];
    const Original = window.AudioContext;
    window.AudioContext = class extends Original {
      constructor(options?: AudioContextOptions) {
        super(options);
        w.__ctx = this;
      }
    };
    const start = OscillatorNode.prototype.start;
    OscillatorNode.prototype.start = function (when?: number) {
      w.__starts.push(when ?? 0);
      return start.call(this, when);
    };
  });
  await open(page);
  await setBpm(page, FAST_BPM);
  await page.mouse.click(5, 5); // unlock audio
  await page.waitForTimeout(300);

  await page.evaluate(() => ((window as unknown as { __starts: number[] }).__starts = []));
  await recButton(page).click();

  // Press "1" (Closed Hat) at the moment the click for recording step 4 reaches the speakers.
  const pressedAt = await page.evaluate(async (bpm) => {
    const w = window as unknown as { __ctx: AudioContext; __starts: number[] };
    while (w.__starts.length === 0) await new Promise((r) => setTimeout(r, 1));
    const stepSec = 60 / bpm / 4;
    const step4 = w.__starts[0] + (12 + 4) * stepSec; // count-in is 12 steps
    const ctx = w.__ctx;
    const heardLatency = (ctx.outputLatency || 0) + (ctx.baseLatency || 0);
    while (ctx.currentTime < step4 + heardLatency) await new Promise((r) => setTimeout(r, 0));
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "1" }));
    return { heardLatencyMs: heardLatency * 1000, lateByMs: (ctx.currentTime - step4 - heardLatency) * 1000 };
  }, FAST_BPM);

  const loop = await savedLoop(page);
  expect(loop, `pressed ${pressedAt.lateByMs.toFixed(1)} ms after hearing step 4; heard latency ${pressedAt.heardLatencyMs.toFixed(1)} ms`).toEqual([
    ["closed_hat", "1", 4],
  ]);
  await recButton(page).click(); // stop
  noErrors();
});
