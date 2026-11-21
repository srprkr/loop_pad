import { expect, test } from "@playwright/test";
import { COUNT_IN_MS, FAST_BPM, LOOP_MS, expectFlash, open, pad, playButton, recButton, setBpm, trackPageErrors } from "./helpers";

test("REC counts in, records 4 bars, then loops what was played", async ({ page }) => {
  const noErrors = trackPageErrors(page);
  await open(page);
  await setBpm(page, FAST_BPM);

  await recButton(page).click();
  await expect(recButton(page)).toHaveText("COUNT");

  // Recording starts after the 3-beat count-in.
  await expect(recButton(page)).toHaveText("REC", { timeout: COUNT_IN_MS + 1000 });
  await expect(playButton(page)).toHaveText("PLAY");
  await page.keyboard.press("1"); // Closed Hat, recorded into the loop

  // After 4 bars it switches to playback by itself...
  await expect(playButton(page)).toHaveText("PAUSE", { timeout: LOOP_MS + 1000 });

  // ...and plays the recorded hit back once per loop.
  await expect(pad(page, "1")).not.toHaveAttribute("data-hit", "true", { timeout: 1000 });
  await expectFlash(page, "1", LOOP_MS + 1000);

  await playButton(page).click();
  await expect(playButton(page)).toHaveText("PLAY");
  noErrors();
});

test("REC again during the count-in stops", async ({ page }) => {
  await open(page);
  await recButton(page).click();
  await expect(recButton(page)).toHaveText("COUNT");
  await recButton(page).click();
  await expect(recButton(page)).toHaveText("REC");
  await expect(playButton(page)).toHaveText("PLAY");
});

test("PLAY with nothing recorded just runs the metronome, and PAUSE stops", async ({ page }) => {
  const noErrors = trackPageErrors(page);
  await open(page);
  await playButton(page).click();
  await expect(playButton(page)).toHaveText("PAUSE");
  await page.waitForTimeout(500);
  await expect(page.locator('[data-hit="true"]')).toHaveCount(0);
  await playButton(page).click();
  await expect(playButton(page)).toHaveText("PLAY");
  noErrors();
});

test("TAP sets the tempo from the tap intervals", async ({ page }) => {
  await open(page);
  const tap = page.getByRole("button", { name: "TAP" });
  for (let i = 0; i < 4; i++) {
    await tap.click();
    if (i < 3) await page.waitForTimeout(400);
  }
  // 400 ms apart is 150 BPM; allow for the time each click takes.
  const bpm = Number(await page.getByTitle("Tempo (BPM)").inputValue());
  expect(bpm).toBeGreaterThan(130);
  expect(bpm).toBeLessThanOrEqual(150);
});
