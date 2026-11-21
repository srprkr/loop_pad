/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Relative asset paths, so dist/ works from any folder or sub-path (e.g. GitHub Pages).
  base: "./",
  build: {
    target: "es2020",
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  test: {
    // Unit tests only; the browser tests in e2e/ run with Playwright.
    include: ["src/**/*.test.ts"],
  },
});
