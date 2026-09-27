import { describe, expect, it, beforeEach } from "vitest";
import {
  BRAND,
  HOME_TITLE,
  claimPageTitle,
  composePageTitle,
  humanizeSegment,
  isPageTitleClaimed,
  releasePageTitle,
  resolvePageName,
  resolvePageTitle,
  syncRouteTitle,
} from "./pageTitle";

const sample = (path: string) => resolvePageTitle(path);

describe("humanizeSegment", () => {
  it("title cases hyphenated slugs", () => {
    expect(humanizeSegment("brand-deals")).toBe("Brand Deals");
    expect(humanizeSegment("live-events")).toBe("Live Events");
    expect(humanizeSegment("audio-rooms")).toBe("Audio Rooms");
  });

  it("uppercases known acronyms", () => {
    expect(humanizeSegment("kyc")).toBe("KYC");
    expect(humanizeSegment("ai-assistant")).toBe("AI Assistant");
    expect(humanizeSegment("sms-engine")).toBe("SMS Engine");
    expect(humanizeSegment("cms")).toBe("CMS");
  });

  it("keeps short connector words lowercase", () => {
    expect(humanizeSegment("link-in-bio")).toBe("Link in Bio");
  });
});

describe("composePageTitle", () => {
  it("returns the brand tagline when there is no page name", () => {
    expect(composePageTitle("")).toBe(HOME_TITLE);
    expect(composePageTitle("   ")).toBe(HOME_TITLE);
  });

  it("appends the brand as a suffix", () => {
    expect(composePageTitle("Wallet")).toBe(`Wallet | ${BRAND}`);
  });

  it("does not duplicate the brand when the title already has it", () => {
    expect(composePageTitle("Stream · Live on MurihSpace")).toBe("Stream · Live on MurihSpace");
  });
});

describe("resolvePageTitle", () => {
  it("keeps the brand tagline only on the home page", () => {
    expect(sample("/")).toBe(HOME_TITLE);
    expect(sample("")).toBe(HOME_TITLE);
  });

  it("titles app routes by page", () => {
    expect(sample("/app/messages")).toBe(`Messages | ${BRAND}`);
    expect(sample("/app/wallet")).toBe(`Wallet | ${BRAND}`);
    expect(sample("/app")).toBe(`Home | ${BRAND}`);
  });

  it("disambiguates securegate admin routes from user routes", () => {
    expect(sample("/app/securegate")).toBe(`Admin Dashboard | ${BRAND}`);
    expect(sample("/app/securegate/users")).toBe(`Admin · Users | ${BRAND}`);
    expect(sample("/app/securegate/analytics/overview")).toBe(
      `Admin · Analytics · Overview | ${BRAND}`,
    );
  });

  it("keeps a bare /app/<tab> from being swallowed by the app splat", () => {
    expect(sample("/app/friends")).toBe(`Friends | ${BRAND}`);
    expect(sample("/app/communities")).toBe(`Communities | ${BRAND}`);
    expect(sample("/app/groups")).toBe(`Groups | ${BRAND}`);
  });

  it("uses section names for public tab splat routes", () => {
    expect(sample("/friends/requests")).toBe(`Friends | ${BRAND}`);
    expect(sample("/courses/design")).toBe(`Courses | ${BRAND}`);
  });

  it("groups nested sections", () => {
    expect(sample("/app/analytics/traffic")).toBe(`Analytics · Traffic | ${BRAND}`);
    expect(sample("/app/settings/security")).toBe(`Settings · Security | ${BRAND}`);
  });

  it("titles dynamic public routes by content type, not by slug", () => {
    expect(sample("/p/12345")).toBe(`Product | ${BRAND}`);
    expect(sample("/u/alice")).toBe(`Profile | ${BRAND}`);
    expect(sample("/c/some-community")).toBe(`Community | ${BRAND}`);
    expect(sample("/app/groups/my-group")).toBe(`Group | ${BRAND}`);
  });

  it("prefers explicit names over humanized segments", () => {
    expect(resolvePageName("/login")).toBe("Sign In");
    expect(resolvePageName("/help")).toBe("Help Center");
    expect(resolvePageName("/terms")).toBe("Terms of Service");
    expect(resolvePageName("/app/kyc")).toBe("KYC Verification");
  });

  it("normalises trailing slashes and query strings", () => {
    expect(sample("/app/messages/")).toBe(sample("/app/messages"));
    expect(sample("/app/messages?tab=unread")).toBe(sample("/app/messages"));
  });

  it("does not leak raw route params into titles", () => {
    for (const path of ["/store/acme", "/app/events/42", "/live/abc123", "/media-kit/9"]) {
      expect(sample(path)).not.toMatch(/[:*]/);
    }
  });

  it("falls back to the brand for opaque id-only segments", () => {
    expect(sample("/app/communities/9f8e7d6c-5b4a-4c3d-8e2f-1a2b3c4d5e6f")).not.toContain("9f8e7d6c");
  });
});

describe("title claim precedence", () => {
  beforeEach(() => {
    releasePageTitle(window.location.pathname);
    document.title = "";
  });

  it("lets a page claim override the route-derived title", () => {
    claimPageTitle("/store/acme", `Acme | ${BRAND}`);
    syncRouteTitle("/store/acme");
    expect(document.title).toBe(`Acme | ${BRAND}`);
  });

  it("does not let a stale claim from a previous route block a new one", () => {
    claimPageTitle("/store/acme", `Acme | ${BRAND}`);
    syncRouteTitle("/app/wallet");
    expect(document.title).toBe(`Wallet | ${BRAND}`);
  });

  it("releases the claim so the route title can apply again", () => {
    claimPageTitle("/store/acme", `Acme | ${BRAND}`);
    releasePageTitle("/store/acme");
    expect(isPageTitleClaimed("/store/acme")).toBe(false);
    syncRouteTitle("/store/acme");
    expect(document.title).toBe(`Storefront | ${BRAND}`);
  });

  it("restores the route title on release while still on the same path", () => {
    window.history.pushState({}, "", "/store/acme");
    claimPageTitle("/store/acme", `Acme | ${BRAND}`);
    releasePageTitle("/store/acme");
    expect(document.title).toBe(`Storefront | ${BRAND}`);
  });

  it("does not touch the title when releasing from a different path", () => {
    window.history.pushState({}, "", "/app/wallet");
    document.title = `Wallet | ${BRAND}`;
    releasePageTitle("/store/acme");
    expect(document.title).toBe(`Wallet | ${BRAND}`);
  });
});
