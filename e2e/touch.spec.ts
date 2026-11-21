import { devices, expect, test } from "@playwright/test";
import { pad, peakOutput, playButton, recButton, tapAudioOutput, trackPageErrors } from "./helpers";

// A phone: touch input, mobile viewport. No autoplay exception, so audio must be unlocked by
// the taps themselves, as on a real phone.
test.use({ ...devices["Pixel 7"], launchOptions: { args: ["--autoplay-policy=user-gesture-required"] } });

test.beforeEach(async ({ page }) => {
  await tapAudioOutput(page);
  await page.goto("/");
  await expect(page.locator("[data-pad]")).toHaveCount(16);
});

test("the very first tap on a pad makes sound", async ({ page }) => {
  const noErrors = trackPageErrors(page);
  await pad(page, "Z").tap();
  expect(await peakOutput(page)).toBeGreaterThan(0.1);
  noErrors();
});

test("later taps make sound and select the pad", async ({ page }) => {
  await pad(page, "Z").tap();
  await page.waitForTimeout(400);
  await pad(page, "X").tap();
  expect(await peakOutput(page)).toBeGreaterThan(0.1);
  await expect(pad(page, "X")).toHaveClass(/ring-2/);
});

test("the whole layout fits the phone screen", async ({ page }) => {
  const viewport = page.viewportSize()!;
  for (const key of ["1", "4", "Z", "V"]) {
    const box = (await pad(page, key).boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
    expect(box.width).toBeGreaterThan(44); // comfortably tappable
  }
});

test("transport buttons work by touch", async ({ page }) => {
  await recButton(page).tap();
  await expect(recButton(page)).toHaveText("COUNT");
  await recButton(page).tap();
  await expect(recButton(page)).toHaveText("REC");
  await playButton(page).tap();
  await expect(playButton(page)).toHaveText("PAUSE");
});

test("inspector faders reset on a double tap", async ({ page }) => {
  await page.getByRole("button", { name: "EDIT" }).tap();
  await page.waitForTimeout(500); // two quick taps in different places can register as one gesture
  const fader = page.getByTitle("Double-click or double-tap to reset (100%)").locator("[data-slider]");
  const box = (await fader.boundingBox())!;

  // Tap the volume fader at the bottom...
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height - 1);
  await expect(page.getByRole("button", { name: /^[0-9]%$/ })).toBeVisible(); // near the bottom: 0-9%
  await page.waitForTimeout(500); // so the next tap doesn't count as a double tap

  // ...then double-tap it back to 100%.
  await page.touchscreen.tap(box.x + box.width / 2, box.y + 2);
  await page.touchscreen.tap(box.x + box.width / 2, box.y + 2);
  await expect(page.getByRole("button", { name: "100%" })).toBeVisible();
});
