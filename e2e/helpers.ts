import { expect, type Page } from "@playwright/test";

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

/** Waits until a pad flashes (it lights up for ~90-120 ms when it plays). */
export async function expectFlash(page: Page, key: string, timeout: number) {
  await expect(pad(page, key)).toHaveAttribute("data-hit", "true", { timeout });
}
