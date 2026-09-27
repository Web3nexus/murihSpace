import { describe, expect, it } from "vitest";
import type { RouteObject } from "react-router";
import { routes } from "./routes";
import { BRAND, resolvePageTitle } from "@/lib/pageTitle";

function join(parent: string, path?: string): string {
  if (!path) return parent;
  if (path.startsWith("/")) return path;
  const base = parent === "/" ? "" : parent;
  return `${base}/${path}`.replace(/\/+/g, "/");
}

function collectPatterns(list: RouteObject[], parent: string, out: Set<string>) {
  for (const route of list) {
    const full = join(parent, route.path);
    if (route.path !== undefined) out.add(full);
    if (route.children) collectPatterns(route.children, full, out);
  }
}

const GENERIC = BRAND;

describe("route title coverage", () => {
  const patterns = new Set<string>();
  collectPatterns(routes, "/", patterns);

  const concrete = [...patterns].filter((p) => !p.includes("*"));
  const SAMPLE = "acme";
  const resolved = concrete.map((pattern) => {
    const sample = pattern.replace(/:[^/]+/g, SAMPLE);
    return { pattern, sample, title: resolvePageTitle(sample) };
  });

  it("discovers the real route table", () => {
    expect(patterns.size).toBeGreaterThan(150);
  });

  it("gives every concrete route a real page name", () => {
    const generic = resolved.filter((r) => r.title === GENERIC && r.pattern !== "/");
    expect(generic.map((r) => r.pattern)).toEqual([]);
  });

  it("never leaves a raw param or splat in a title", () => {
    const leaky = resolved.filter((r) => /[:*]/.test(r.title));
    expect(leaky.map((r) => `${r.pattern} -> ${r.title}`)).toEqual([]);
  });

  it("never produces an unfilled template in a title", () => {
    const templated = resolved.filter((r) => /undefined|NaN|\{\}/.test(r.title));
    expect(templated.map((r) => `${r.pattern} -> ${r.title}`)).toEqual([]);
  });

  it("never leaks a route param value into a title", () => {
    const leaked = resolved.filter((r) => r.title.toLowerCase().includes(SAMPLE));
    expect(leaked.map((r) => `${r.pattern} -> ${r.title}`)).toEqual([]);
  });

  it("never gives an admin route the same title as a user-facing route", () => {
    const isAdmin = (pattern: string) => pattern.includes("/app/securegate");
    const adminTitles = new Set(
      resolved.filter((r) => isAdmin(r.pattern)).map((r) => r.title),
    );
    const clashing = resolved.filter(
      (r) => !isAdmin(r.pattern) && adminTitles.has(r.title),
    );
    expect(clashing.map((r) => `${r.pattern} -> ${r.title}`)).toEqual([]);
  });
});
