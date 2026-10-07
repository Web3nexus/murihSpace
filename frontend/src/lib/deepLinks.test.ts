import { describe, expect, it } from "vitest";
import { isReturnableRoute, normaliseLink, resolveDeepLink, sanitiseReturnTo } from "./deepLinks";

/**
 * The resolver decides where a shared link lands when the recipient has no app
 * installed. Every bug here is silent: a shape that resolves to the wrong
 * entity still renders a page, just not the one that was shared.
 */
describe("normaliseLink", () => {
  it("accepts the custom scheme, a bare host and a relative path", () => {
    expect(normaliseLink("murihspace://m/abc").path).toBe("/m/abc");
    expect(normaliseLink("web.murihspace.com/m/abc").path).toBe("/m/abc");
    expect(normaliseLink("/m/abc?ref=1").query).toBe("ref=1");
  });

  it("rejects a non-http scheme", () => {
    expect(normaliseLink("javascript:alert(1)").path).toBe("/");
  });
});

describe("resolveDeepLink", () => {
  it("resolves every canonical shape", () => {
    expect(resolveDeepLink("/m/kwy-aqgw-vhh")).toMatchObject({ type: "meeting", identifier: "kwy-aqgw-vhh" });
    expect(resolveDeepLink("/e/42")).toMatchObject({ type: "event", identifier: "42" });
    expect(resolveDeepLink("/p/d_7")).toMatchObject({ type: "product", identifier: "d_7" });
    expect(resolveDeepLink("/c/design")).toMatchObject({ type: "community", identifier: "design" });
    expect(resolveDeepLink("/u/ada")).toMatchObject({ type: "profile", identifier: "ada" });
    expect(resolveDeepLink("/chat/9")).toMatchObject({ type: "chat", identifier: "9" });
    expect(resolveDeepLink("/store/ada")).toMatchObject({ type: "storefront", identifier: "ada" });
  });

  it("reads a storefront product path as a product, not the storefront", () => {
    // `second` is the short code; the id is the fourth segment. Getting this
    // wrong hands the recipient the store instead of the product they shared.
    const target = resolveDeepLink("/store/ada/p/5");
    expect(target).toMatchObject({ type: "product", identifier: "5", route: "/p/5" });
  });

  it("keeps a query string on a route that already has one", () => {
    expect(resolveDeepLink("/chat/9?ref=email").route).toBe("/app/messages?conversation=9&ref=email");
    expect(resolveDeepLink("/m/abc?ref=email").route).toBe("/m/abc?ref=email");
  });

  it("treats the reserved instant route as no room at all", () => {
    expect(resolveDeepLink("/m/instant").type).toBe("unknown");
    expect(resolveDeepLink("/app/meeting/instant").type).toBe("unknown");
  });

  it("maps every legacy alias to its canonical target", () => {
    expect(resolveDeepLink("/meetings/abc")).toMatchObject({ type: "meeting", route: "/m/abc" });
    expect(resolveDeepLink("/meeting/abc")).toMatchObject({ type: "meeting", route: "/m/abc" });
    expect(resolveDeepLink("/app/meeting/abc")).toMatchObject({ type: "meeting", route: "/m/abc" });
    expect(resolveDeepLink("/events/5")).toMatchObject({ type: "event", route: "/e/5" });
    expect(resolveDeepLink("/products/5")).toMatchObject({ type: "product", route: "/p/5" });
    expect(resolveDeepLink("/community/design")).toMatchObject({ type: "community", route: "/c/design" });
    expect(resolveDeepLink("/communities/design")).toMatchObject({ type: "community", route: "/c/design" });
    // Link-in-bio keeps its own page on web: `/l/:username` renders
    // PublicLinkInBioPage, which is what a shared bio link asked for.
    expect(resolveDeepLink("/l/ada")).toMatchObject({ type: "linkInBio", route: "/l/ada" });
    expect(resolveDeepLink("/bio/ada")).toMatchObject({ type: "linkInBio", route: "/l/ada" });
  });

  it("returns unknown rather than guessing", () => {
    expect(resolveDeepLink("/definitely/not/a/route").type).toBe("unknown");
    expect(resolveDeepLink("").type).toBe("unknown");
  });
});

describe("returnTo safety", () => {
  it("keeps internal destinations", () => {
    expect(sanitiseReturnTo("/m/abc")).toBe("/m/abc");
    expect(sanitiseReturnTo("/app/messages?conversation=3")).toBe("/app/messages?conversation=3");
  });

  it("rejects absolute and protocol-relative destinations", () => {
    expect(sanitiseReturnTo("https://evil.example/steal")).toBeNull();
    expect(sanitiseReturnTo("//evil.example/steal")).toBeNull();
    expect(sanitiseReturnTo("murihspace://m/abc")).toBeNull();
    expect(sanitiseReturnTo(null)).toBeNull();
  });

  it("matches a route on a path boundary", () => {
    expect(isReturnableRoute("/m/abc")).toBe(true);
    expect(isReturnableRoute("/app")).toBe(true);
    // A sibling path sharing a prefix must not be treated as in-app.
    expect(isReturnableRoute("/application")).toBe(false);
    expect(isReturnableRoute("/app-external")).toBe(false);
  });
});
