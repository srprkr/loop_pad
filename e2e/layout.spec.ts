import { expect, test } from "@playwright/test";
import { open, pad, trackPageErrors } from "./helpers";

test("opens on the 4x4 grid with the first pad selected and the inspector closed", async ({ page }) => {
  const noErrors = trackPageErrors(page);
  await open(page);

  await expect(page.locator("[data-pad]")).toHaveCount(16);
  await expect(pad(page, "1")).toContainText("Closed Hat");
  await expect(pad(page, "V")).toContainText("Noise Drop");
  await expect(pad(page, "1")).toHaveClass(/ring-2/);
  await expect(page.getByText("Pad Inspector")).toHaveCount(0);
  noErrors();
});

test("EDIT shows and hides the Pad Inspector for the selected pad", async ({ page }) => {
  const noErrors = trackPageErrors(page);
  await open(page);

  await page.getByRole("button", { name: "EDIT" }).click();
  await expect(page.getByText("Pad Inspector")).toBeVisible();
  await expect(page.getByText("[1] Closed Hat")).toBeVisible();
  await expect(page.getByText("Theme: Amber Gold")).toBeVisible();

  await page.getByRole("button", { name: "EDIT" }).click();
  await expect(page.getByText("Pad Inspector")).toHaveCount(0);
  noErrors();
});

test("grid sizes show their own pad sets, with Y U I O P on the 5x5 fifth row", async ({ page }) => {
  const noErrors = trackPageErrors(page);
  await open(page);

  await page.getByRole("button", { name: "3x3" }).click();
  await expect(page.locator("[data-pad]")).toHaveCount(9);
  await expect(pad(page, "D")).toContainText("Punch Kick");

  await page.getByRole("button", { name: "5x5" }).click();
  await expect(page.locator("[data-pad]")).toHaveCount(25);
  for (const [key, name] of [["Y", "Click Kick"], ["U", "Punch Kick"], ["I", "Sub 808"], ["O", "Thud Kick"], ["P", "Noise Drop"]])
    await expect(pad(page, key)).toContainText(name);
  noErrors();
});

test("keys play pads and select them", async ({ page }) => {
  const noErrors = trackPageErrors(page);
  await open(page);
  await page.getByRole("button", { name: "EDIT" }).click();

  await page.keyboard.press("w");
  await expect(pad(page, "W")).toHaveClass(/ring-2/);
  await expect(page.getByText("[W] Tight Snare")).toBeVisible();
  noErrors();
});
