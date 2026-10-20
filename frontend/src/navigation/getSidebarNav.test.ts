import { beforeEach, describe, expect, it, vi } from "vitest";

const ads = vi.hoisted(() => ({ href: undefined as string | undefined }));

vi.mock("@/lib/adsManager", () => ({
  getAdsManagerHref: () => ads.href,
}));

import { resolveExternalItems } from "@/navigation/getSidebarNav";
import { creatorNav } from "@/navigation/creatorNav";
import { vendorNav } from "@/navigation/vendorNav";
import type { NavGroup } from "@/navigation/navTypes";

const allItems = (groups: NavGroup[]) => groups.flatMap((g) => g.items);

beforeEach(() => {
  ads.href = undefined;
});

describe("Ads Manager sidebar entry", () => {
  it("creator sidebar has one Ads Manager entry and no Marketing entry", () => {
    const titles = allItems(creatorNav).map((i) => i.title);
    expect(titles.filter((t) => t === "Ads Manager")).toHaveLength(1);
    expect(titles).not.toContain("Marketing");
    expect(allItems(creatorNav).some((i) => i.url === "/app/marketing")).toBe(false);
  });

  it("vendor sidebar marks Ads Manager as external", () => {
    const item = allItems(vendorNav).find((i) => i.title === "Ads Manager");
    expect(item?.external).toBe("ads-manager");
    expect(item?.description).toMatch(/MurihSpace account/);
  });

  it("points the item at the configured address", () => {
    ads.href = "https://ads.example.test";
    const item = allItems(resolveExternalItems(creatorNav)).find((i) => i.title === "Ads Manager");
    expect(item?.url).toBe("https://ads.example.test");
  });

  it("hides the item when no safe address is configured", () => {
    ads.href = undefined;
    const titles = allItems(resolveExternalItems(creatorNav)).map((i) => i.title);
    expect(titles).not.toContain("Ads Manager");
    expect(titles).toContain("Brand Deals");
  });

  it("leaves ordinary items untouched", () => {
    ads.href = "https://ads.example.test";
    const before = allItems(creatorNav).filter((i) => !i.external);
    const after = allItems(resolveExternalItems(creatorNav)).filter((i) => !i.external);
    expect(after).toEqual(before);
  });
});
