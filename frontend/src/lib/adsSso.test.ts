import { describe, expect, it } from "vitest";
import {
  buildAdsCallbackUrl,
  isValidSsoState,
  parseAllowedAdsRedirect,
  readErrorCode,
} from "@/lib/adsSso";
import { isReturnableRoute, sanitiseReturnTo } from "@/lib/deepLinks";

describe("isValidSsoState", () => {
  it("accepts values between 16 and 128 characters", () => {
    expect(isValidSsoState("a".repeat(16))).toBe(true);
    expect(isValidSsoState("a".repeat(128))).toBe(true);
  });

  it("rejects missing or out-of-range values", () => {
    expect(isValidSsoState(null)).toBe(false);
    expect(isValidSsoState("")).toBe(false);
    expect(isValidSsoState("a".repeat(15))).toBe(false);
    expect(isValidSsoState("a".repeat(129))).toBe(false);
  });
});

describe("parseAllowedAdsRedirect", () => {
  it("accepts a URL on the configured Ads origin", () => {
    expect(parseAllowedAdsRedirect("https://ads.example.test/cb", "https://ads.example.test")?.pathname).toBe("/cb");
  });

  it("rejects other origins, lookalike hosts and other schemes", () => {
    const base = "https://ads.example.test";
    expect(parseAllowedAdsRedirect("https://ads.example.test.evil.com/cb", base)).toBeNull();
    expect(parseAllowedAdsRedirect("https://evil.example.test/cb", base)).toBeNull();
    expect(parseAllowedAdsRedirect("javascript:alert(1)", base)).toBeNull();
  });

  it("rejects everything when VITE_ADS_MANAGER_URL is blank", () => {
    expect(parseAllowedAdsRedirect("https://ads.example.test/cb", "")).toBeNull();
  });
});

describe("buildAdsCallbackUrl", () => {
  it("keeps exactly code and state as query parameters", () => {
    const target = new URL("https://ads.example.test/cb?stale=1#frag");
    const url = new URL(buildAdsCallbackUrl(target, "c o/de", "s".repeat(20)));
    expect([...url.searchParams.keys()]).toEqual(["code", "state"]);
    expect(url.searchParams.get("code")).toBe("c o/de");
    expect(url.hash).toBe("");
  });
});

describe("readErrorCode", () => {
  it("reads the code at top level or under errors", () => {
    expect(readErrorCode({ code: "x" })).toBe("x");
    expect(readErrorCode({ errors: { code: ["x"] } })).toBe("x");
    expect(readErrorCode({ errors: { code: "x" } })).toBe("x");
    expect(readErrorCode(null)).toBeNull();
  });
});

describe("login return path", () => {
  it("keeps the authorize URL with its state query through sanitiseReturnTo", () => {
    const path = `/ads/sso/authorize?state=${"s".repeat(20)}`;
    expect(isReturnableRoute(path)).toBe(true);
    expect(sanitiseReturnTo(path)).toBe(path);
  });

  it("does not treat a look-alike prefix as the authorize page", () => {
    expect(isReturnableRoute("/ads/sso/authorizeevil")).toBe(false);
  });
});
