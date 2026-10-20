import { describe, it, expect } from "vitest";
import routes from "./routes";
import { DEFAULT_STAFF_LOGIN_PATH, resolveStaffLoginPath } from "./lib/staff-login";
import { loader as robotsLoader } from "./routes/robots.txt";

type Entry = { file: string; path?: string; children?: Entry[] };

const STAFF_FILE = "routes/staff-login.tsx";

function flatten(entries: Entry[]): Entry[] {
  return entries.flatMap((e) => [e, ...flatten(e.children ?? [])]);
}

describe("hidden staff login route", () => {
  const tree = routes as unknown as Entry[];

  it("is registered outside the public layout", () => {
    const layout = tree.find((e) => e.file === "components/PublicLayout.tsx");
    expect(layout).toBeDefined();

    const insideLayout = flatten(layout?.children ?? []).map((e) => e.file);
    expect(insideLayout).not.toContain(STAFF_FILE);

    const topLevel = tree.find((e) => e.file === STAFF_FILE);
    expect(topLevel?.path).toBe(DEFAULT_STAFF_LOGIN_PATH);
  });

  it("is not a path any public page uses", () => {
    const publicPaths = flatten(tree)
      .filter((e) => e.file !== STAFF_FILE)
      .map((e) => e.path)
      .filter(Boolean);
    expect(publicPaths).not.toContain(DEFAULT_STAFF_LOGIN_PATH);
  });

  it("robots.txt does not list the staff path", async () => {
    const response = await robotsLoader();
    const text = await response.text();

    expect(text).not.toContain(resolveStaffLoginPath(process.env.STAFF_LOGIN_PATH));
    expect(text).not.toContain(DEFAULT_STAFF_LOGIN_PATH);
    expect(text).not.toMatch(/Disallow:/);
  });
});

describe("resolveStaffLoginPath", () => {
  it("uses the default when unset", () => {
    expect(resolveStaffLoginPath(undefined)).toBe(DEFAULT_STAFF_LOGIN_PATH);
    expect(resolveStaffLoginPath("   ")).toBe(DEFAULT_STAFF_LOGIN_PATH);
  });

  it("strips surrounding slashes", () => {
    expect(resolveStaffLoginPath("/abcdefghijklmnop1234/")).toBe("abcdefghijklmnop1234");
  });

  it("rejects short or unsafe values", () => {
    expect(() => resolveStaffLoginPath("short")).toThrow();
    expect(() => resolveStaffLoginPath("has spaces and/slashes here")).toThrow();
  });
});
