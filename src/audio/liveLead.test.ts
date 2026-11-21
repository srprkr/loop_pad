import { describe, expect, it } from "vitest";
import { liveLeadSec } from "./engine";

describe("tap scheduling lead", () => {
  it("schedules taps 15 ms ahead in Firefox", () => {
    expect(liveLeadSec("Mozilla/5.0 (X11; Linux x86_64; rv:135.0) Gecko/20100101 Firefox/135.0")).toBe(0.015);
    expect(liveLeadSec("Mozilla/5.0 (Android 14; Mobile; rv:135.0) Gecko/135.0 Firefox/135.0")).toBe(0.015);
  });

  it("adds no delay in Chromium, Safari, or Firefox on iOS (which is WebKit)", () => {
    expect(liveLeadSec("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36")).toBe(0);
    expect(liveLeadSec("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15")).toBe(0);
    expect(liveLeadSec("Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/133.0 Mobile/15E148 Safari/605.1.15")).toBe(0);
  });
});
