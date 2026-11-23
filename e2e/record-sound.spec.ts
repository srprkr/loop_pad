import { expect, test, type Page } from "@playwright/test";
import { hitPeaks, open, pad, recordAudioOutput, trackPageErrors } from "./helpers";

// Uses the test browsers' fake microphone (see helpers.ts), never a real one. Runs in Firefox
// as well, which records in a different format (Ogg rather than WebM).

const recordButton = (page: Page) => page.getByRole("button", { name: /^(Record sound|Stop recording|Processing recording)$/ });
const nameField = (page: Page) => page.getByRole("textbox", { name: "Name:" });

/** Taps a pad and returns the loudest hit it produced (dBFS). */
async function tapPeak(page: Page, key: string) {
  await hitPeaks(page);
  await page.keyboard.press(key);
  await page.waitForTimeout(600);
  return Math.max(-100, ...(await hitPeaks(page)));
}

test("record a sound from the mic onto a pad, rename it, and keep it after a reload", async ({ page }) => {
  const noErrors = trackPageErrors(page);
  await recordAudioOutput(page);
  await open(page);
  await page.getByRole("button", { name: "EDIT" }).click();
  await page.mouse.click(5, 5); // unlock audio
  await expect(nameField(page)).toHaveCount(0); // kit sounds have no name field

  // The mic's label is a tooltip, shown on hover.
  const tooltip = page.getByRole("tooltip", { name: /Record sound/ });
  await expect(tooltip).toHaveCSS("opacity", "0");
  await recordButton(page).hover();
  await expect(tooltip).toHaveCSS("opacity", "1");

  // Record onto pad 1 (Closed Hat): about 1.5 s, then stop.
  await recordButton(page).click();
  await expect(recordButton(page)).toHaveAccessibleName("Stop recording");
  await page.waitForTimeout(1500);
  await recordButton(page).click();
  await expect(recordButton(page)).toHaveAccessibleName("Record sound", { timeout: 5000 });
  await expect(page.getByRole("alert")).toHaveCount(0);

  // The pad now plays the recording, under a generic name that can be edited.
  await expect(pad(page, "1")).toContainText("Recording 1");
  await expect(pad(page, "1")).toContainText("custom");
  await expect(nameField(page)).toHaveValue("Recording 1");
  await expect(page.getByTitle("Sound", { exact: true })).toHaveValue(/^rec_/);
  expect(await tapPeak(page, "1")).toBeGreaterThan(-12);

  // Rename it.
  await nameField(page).fill("My Snap");
  await nameField(page).press("Enter");
  await expect(pad(page, "1")).toContainText("My Snap");
  await expect(page.getByText("[1] My Snap")).toBeVisible();

  // Other pads can use it too, from the dropdown.
  await page.keyboard.press("2");
  await page.getByTitle("Sound", { exact: true }).selectOption({ label: "My Snap (CUSTOM)" });
  await expect(pad(page, "2")).toContainText("My Snap");

  // After a reload the name is kept and the recording still plays.
  await page.waitForTimeout(400); // saving is debounced
  await page.reload();
  await expect(pad(page, "1")).toContainText("My Snap");
  await page.mouse.click(5, 5);
  await page.waitForTimeout(500);
  expect(await tapPeak(page, "1")).toBeGreaterThan(-12);

  // Back to a kit sound: the pad takes its name, and the name field goes away.
  await page.keyboard.press("1");
  await page.getByTitle("Sound", { exact: true }).selectOption({ label: "Clap (SNARE)" });
  await expect(pad(page, "1")).toContainText("Clap");
  await expect(nameField(page)).toHaveCount(0);
  noErrors();
});

test("a blank name is not accepted", async ({ page }) => {
  await open(page);
  await page.getByRole("button", { name: "EDIT" }).click();
  await recordButton(page).click();
  await page.waitForTimeout(1200);
  await recordButton(page).click();
  await expect(nameField(page)).toHaveValue("Recording 1", { timeout: 5000 });

  await nameField(page).fill("   ");
  await nameField(page).press("Enter");
  await expect(nameField(page)).toHaveValue("Recording 1");
  await expect(pad(page, "1")).toContainText("Recording 1");
});
