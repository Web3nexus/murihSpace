// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// session.server.ts reads SESSION_SECRET and NODE_ENV when it is first imported,
// so each case resets the module registry and imports it fresh.
async function importSessionModule() {
  vi.resetModules();
  return import("../app/lib/session.server");
}

describe("session secret", () => {
  beforeEach(() => {
    vi.stubEnv("SESSION_SECRET", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("refuses to load in production without SESSION_SECRET", async () => {
    vi.stubEnv("NODE_ENV", "production");
    await expect(importSessionModule()).rejects.toThrow(/SESSION_SECRET must be set in production/);
  });

  it("loads in production when SESSION_SECRET is set", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SESSION_SECRET", "test-only-secret-value-0123456789abcdef");
    const mod = await importSessionModule();
    expect(mod.adminSessionStorage).toBeDefined();
  });

  it("loads in development without SESSION_SECRET", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const mod = await importSessionModule();
    expect(mod.adminSessionStorage).toBeDefined();
  });
});
