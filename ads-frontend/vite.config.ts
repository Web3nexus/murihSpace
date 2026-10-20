import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, loadEnv, type Plugin } from "vite";

/**
 * These values are baked into the bundle at build time. A production build
 * without them would ship relative or empty URLs, so the build fails instead.
 * There are no fallback domains in the source.
 */
const REQUIRED_IN_PRODUCTION = ["VITE_ADS_API_URL", "VITE_MAIN_APP_URL"] as const;

function requireProductionEnv(): Plugin {
  let mode = "";
  return {
    name: "require-production-env",
    configResolved(config) {
      mode = config.mode;
    },
    // buildStart runs only for real builds. Typegen also loads this config, so
    // checking in the config itself would block typecheck without a build env.
    buildStart() {
      if (mode !== "production") return;
      const env = loadEnv(mode, process.cwd(), "VITE_");
      const missing = REQUIRED_IN_PRODUCTION.filter((key) => !(env[key] ?? "").trim());
      if (missing.length > 0) {
        throw new Error(`Refusing to build for production. Missing required env: ${missing.join(", ")}.`);
      }
    },
  };
}

export default defineConfig({
  plugins: [tailwindcss(), reactRouter(), requireProductionEnv()],
  resolve: {
    tsconfigPaths: true,
  },
});
