import { describe, expect, it } from "vitest";
import { getAdsManagerHref } from "@/lib/adsManager";

describe("getAdsManagerHref", () => {
  it("returns a configured https address", () => {
    expect(getAdsManagerHref("https://ads.murihspace.com")).toBe("https://ads.murihspace.com");
  });

  it("trims surrounding whitespace", () => {
    expect(getAdsManagerHref("  https://ads.murihspace.com  ")).toBe("https://ads.murihspace.com");
  });

  it("hides the entry point when the variable is blank", () => {
    expect(getAdsManagerHref("")).toBeUndefined();
    expect(getAdsManagerHref("   ")).toBeUndefined();
  });

  it("rejects unsafe or non-web schemes", () => {
    expect(getAdsManagerHref("javascript:alert(1)")).toBeUndefined();
    expect(getAdsManagerHref("data:text/html,hi")).toBeUndefined();
    expect(getAdsManagerHref("ftp://ads.murihspace.com")).toBeUndefined();
  });

  it("rejects values that are not absolute URLs", () => {
    expect(getAdsManagerHref("ads.murihspace.com")).toBeUndefined();
    expect(getAdsManagerHref("/ads")).toBeUndefined();
  });
});
