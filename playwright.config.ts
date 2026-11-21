import { defineConfig, devices } from "@playwright/test";

// Browser tests: they click through the real app in headless Chromium, with real Web Audio.
// levels.spec.ts also runs in Firefox, whose audio clock behaves differently.
// `npm run test:e2e` starts the dev server (or reuses one that is already running).
export default defineConfig({
  testDir: "e2e",
  timeout: 30_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://127.0.0.1:5173",
    viewport: { width: 720, height: 1080 },
    trace: "retain-on-failure",
    launchOptions: { args: ["--autoplay-policy=no-user-gesture-required"] },
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 720, height: 1080 } } },
    {
      name: "firefox",
      testMatch: "levels.spec.ts",
      use: { ...devices["Desktop Firefox"], viewport: { width: 720, height: 1080 }, launchOptions: {} },
    },
  ],
  webServer: {
    command: "npm run dev -- --host 127.0.0.1",
    url: "http://127.0.0.1:5173",
    reuseExistingServer: !process.env.CI,
  },
});
