import { expect, test } from "@playwright/test";
import { COUNT_IN_MS, FAST_BPM, LOOP_MS, expectFlash, open, pad, playButton, recButton, setBpm, trackPageErrors } from "./helpers";

test("settings, grid size and the inspector survive a reload", async ({ page }) => {
  const noErrors = trackPageErrors(page);
  await open(page);

  await page.getByRole("button", { name: "EDIT" }).click();
  await page.getByRole("button", { name: "5x5" }).click();
  await setBpm(page, 150);
  await page.getByTitle("Mute").click();
  await page.waitForTimeout(500); // saving is debounced

  await page.reload();
  await expect(page.getByTitle("Tempo (BPM)")).toHaveValue("150");
  await expect(page.getByText("Pad Inspector")).toBeVisible();
  await expect(page.locator("[data-pad]")).toHaveCount(25);
  await expect(page.getByTitle("Unmute")).toBeVisible();
  noErrors();
});

test("a recorded loop survives a reload and plays back", async ({ page }) => {
  const noErrors = trackPageErrors(page);
  await open(page);
  await setBpm(page, FAST_BPM);

  await recButton(page).click();
  await expect(recButton(page)).toHaveText("REC", { timeout: COUNT_IN_MS + 1000 });
  await page.keyboard.press("z"); // Punch Kick
  await page.waitForTimeout(500);

  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("loop-pad:v1") ?? "{}").loop);
  expect(saved.map((n: { soundType: string; padKey: string }) => [n.soundType, n.padKey])).toEqual([["punch_kick", "Z"]]);

  await page.reload();
  await expect(pad(page, "Z")).toBeVisible();
  await playButton(page).click();
  await expectFlash(page, "Z", LOOP_MS + 1000);
  noErrors();
});
