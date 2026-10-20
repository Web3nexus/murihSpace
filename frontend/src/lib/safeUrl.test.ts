import { describe, expect, it } from "vitest";
import { safeHref } from "./safeUrl";

describe("safeHref", () => {
  it("keeps web, mail and phone links", () => {
    expect(safeHref("https://example.com/a?b=1")).toBe("https://example.com/a?b=1");
    expect(safeHref("http://example.com")).toBe("http://example.com");
    expect(safeHref("mailto:hi@example.com")).toBe("mailto:hi@example.com");
    expect(safeHref("tel:+254700000000")).toBe("tel:+254700000000");
  });

  it("keeps relative and schemeless paths", () => {
    expect(safeHref("/app/feed")).toBe("/app/feed");
    expect(safeHref("example.com/page")).toBe("example.com/page");
  });

  it("drops script and data URLs, including obfuscated forms", () => {
    expect(safeHref("javascript:alert(1)")).toBeUndefined();
    expect(safeHref("  JavaScript:alert(1)")).toBeUndefined();
    expect(safeHref("java\tscript:alert(1)")).toBeUndefined();
    expect(safeHref("\u0001javascript:alert(1)")).toBeUndefined();
    expect(safeHref("data:text/html,<script>alert(1)</script>")).toBeUndefined();
    expect(safeHref("vbscript:msgbox(1)")).toBeUndefined();
  });

  it("returns undefined for empty input", () => {
    expect(safeHref(undefined)).toBeUndefined();
    expect(safeHref(null)).toBeUndefined();
    expect(safeHref("")).toBeUndefined();
  });
});
