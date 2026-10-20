import { defineConfig } from "vitest/config";

// Kept separate from vite.config.ts so tests do not load the React Router build plugin.
export default defineConfig({
  resolve: {
    // Matches vite.config.ts so the "~/" alias used by the UI components resolves in tests.
    tsconfigPaths: true,
  },
  test: {
    include: ["tests/**/*.test.{ts,tsx}"],
    environment: "jsdom",
    clearMocks: true,
  },
});
