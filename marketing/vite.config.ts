/// <reference types="vitest" />
import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [
    tailwindcss(),
    process.env.VITEST ? react() : reactRouter(),
    tsconfigPaths(),
  ],
  server: {
    port: 3000,
  },
  // @ts-expect-error — Vitest extends Vite config at runtime
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./app/test-setup.ts"],
  },
});
