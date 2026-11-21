import { expect, test } from "@playwright/test";
import { hitPeaks, open, recordAudioOutput, trackPageErrors } from "./helpers";

// Runs in Firefox as well as Chromium. Firefox's audio clock lags what it has already played, and
// taps scheduled at currentTime came out up to 10 dB quieter at random (engine.ts, LIVE_LEAD_SEC).
test("every tap of a pad comes out at the same level", async ({ page }) => {
  const noErrors = trackPageErrors(page);
  await recordAudioOutput(page);
  await open(page);
  await page.mouse.click(5, 5); // unlock audio
  await page.waitForTimeout(300);
  await hitPeaks(page); // discard anything so far

  // Closed Hat: the shortest decay, so the most sensitive to a late start. Uneven gaps, so the
  // taps land at different points of the browser's audio chunks.
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press("1");
    await page.waitForTimeout(220 + ((i * 37) % 110));
  }
  await page.waitForTimeout(300);

  const peaks = await hitPeaks(page);
  expect(peaks).toHaveLength(12);
  expect(Math.max(...peaks) - Math.min(...peaks), `tap levels (dBFS): ${peaks.map((p) => p.toFixed(1)).join(", ")}`).toBeLessThan(1);
  noErrors();
});

test("loud hits don't clip: the limiter keeps the output at or under -1 dBFS", async ({ page }) => {
  const noErrors = trackPageErrors(page);
  await recordAudioOutput(page);
  await open(page);
  await page.mouse.click(5, 5); // unlock audio; the limiter loads right after
  await page.waitForTimeout(500);
  await hitPeaks(page);

  // Punch Kick on Z peaks above 0 dBFS on its own, and two at once add up further.
  for (let i = 0; i < 4; i++) {
    await page.keyboard.down("Z");
    await page.keyboard.down("X"); // Sub 808
    await page.keyboard.up("Z");
    await page.keyboard.up("X");
    await page.waitForTimeout(400);
  }
  await page.waitForTimeout(300);

  const peaks = await hitPeaks(page);
  expect(peaks.length).toBeGreaterThan(0);
  expect(Math.max(...peaks), `hit peaks (dBFS): ${peaks.map((p) => p.toFixed(2)).join(", ")}`).toBeLessThanOrEqual(-0.99);
  noErrors();
});
