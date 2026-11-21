import { expect, test } from "@playwright/test";
import { COUNT_IN_MS, FAST_BPM, LOOP_MS, expectFlash, open, pad, playButton, recButton, savedLoop, setBpm, trackPageErrors } from "./helpers";

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
  const loop = await savedLoop(page);
  expect(loop.map(([sound, key]) => [sound, key])).toEqual([["closed_hat", "1"]]);

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
  // A controlled clock, so the taps are exactly 500 ms apart however long each click takes.
  await page.clock.install();
  await open(page);
  await page.clock.pauseAt(new Date("2030-01-01T00:00:00Z"));
  const tap = page.getByRole("button", { name: "TAP" });
  for (let i = 0; i < 4; i++) {
    if (i > 0) await page.clock.runFor(500);
    await tap.click();
  }
  await expect(page.getByTitle("Tempo (BPM)")).toHaveValue("120");
});
