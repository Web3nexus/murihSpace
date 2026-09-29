// The "/vitest" entry registers the matchers *and* augments expect()'s types.
// The bare entry only registers at runtime, which fails `tsc` on Vitest 5.
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Clean up DOM after each test
afterEach(() => {
  cleanup();
});
