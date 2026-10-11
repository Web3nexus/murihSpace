import { describe, expect, it } from "vitest";
import { EMOJI_MANIFEST, EMOJI_KEYS } from "./emoji-manifest";
import { EMOJI_REGEX, emojiAssetUrl } from "./emoji";

describe("emoji manifest", () => {
  it("covers every emoji key with an asset and no empty labels", () => {
    const keys = Object.keys(EMOJI_MANIFEST);
    expect(keys.length).toBeGreaterThan(600);
    for (const k of keys) {
      expect(k.length).toBeGreaterThan(0);
      expect(EMOJI_MANIFEST[k]).toMatch(/^[^/]+\/[^/]+\.webp$/);
    }
    expect(new Set(EMOJI_KEYS).size).toBe(EMOJI_KEYS.length);
  });

  it("prefers the longest key first so multi-codepoint emoji match before prefixes", () => {
    for (let i = 1; i < EMOJI_KEYS.length; i++) {
      expect(EMOJI_KEYS[i - 1].length).toBeGreaterThanOrEqual(EMOJI_KEYS[i].length);
    }
  });
});

describe("EMOJI_REGEX split", () => {
  it("keeps plain text interleaved with populated emoji captures", () => {
    const parts = "hi 👍 there ❤️!".split(EMOJI_REGEX);
    expect(parts).toEqual(["hi ", "👍", " there ", "❤️", "!"]);
  });

  it("leaves text without emoji untouched", () => {
    expect("just words".split(EMOJI_REGEX)).toEqual(["just words"]);
  });

  it("does not split a ZWJ family sequence", () => {
    const family = "👨‍👩‍👧";
    if (family in EMOJI_MANIFEST) {
      expect("loved " + family + " here".split(EMOJI_REGEX)).toEqual([
        "loved ",
        family,
        " here",
      ]);
    }
  });
});

describe("emojiAssetUrl", () => {
  it("builds a percent-encoded URL on the API origin", () => {
    const url = emojiAssetUrl("🙏") ?? "";
    expect(url).toMatch(/^https?:\/\/[^/]+\/emoji\/[^/]+\/[^ ]+\.webp$/);
    expect(url).not.toMatch(/\s/);
  });

  it("returns null for an emoji the pack does not ship", () => {
    expect(emojiAssetUrl("🫨")).toBeNull();
  });
});