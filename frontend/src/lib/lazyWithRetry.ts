import { asApiError } from "@/lib/apiError";
import type React from "react";
import { lazy } from "react";

/**
 * Lazy loads a component with automated chunk loading retry.
 * If a new deployment has taken place and the browser attempts to load
 * a stale chunk hash (resulting in a 404 / Failed to fetch dynamically imported module),
 * this helper intercepts the failure, saves a reload flag to prevent loops, and reloads
 * the page so the browser receives the newest index.html and chunk manifests.
 */
export function lazyWithRetry<P>(
  factory: () => Promise<{ default: React.ComponentType<P> } | Record<string, unknown>>,
  namedExport?: string
): React.LazyExoticComponent<React.ComponentType<P>> {
  return lazy(async () => {
    try {
      const module: Record<string, unknown> = await factory();
      // On successful module load, clear the reload flag
      try {
        sessionStorage.removeItem("chunk_reload_attempted");
      } catch { /* ignored: best-effort, failure is non-fatal */ }

      if (namedExport && module[namedExport]) {
        return { default: module[namedExport] as React.ComponentType<P> };
      }
      if ("default" in module && module.default) {
        return { default: module.default as React.ComponentType<P> };
      }
      return { default: module as unknown as React.ComponentType<P> };
    } catch (error: unknown) {
      const errorMessage = asApiError(error).message || String(error);
      const isChunkError =
        errorMessage.includes("Failed to fetch dynamically imported module") ||
        errorMessage.includes("Importing a module script failed") ||
        errorMessage.includes("error loading dynamically imported module") ||
        errorMessage.includes("ChunkLoadError") ||
        errorMessage.includes("Loading chunk");

      let reloadAttempted = false;
      try {
        reloadAttempted = !!sessionStorage.getItem("chunk_reload_attempted");
      } catch { /* ignored: best-effort, failure is non-fatal */ }

      if (isChunkError && !reloadAttempted) {
        try {
          sessionStorage.setItem("chunk_reload_attempted", "true");
        } catch { /* ignored: best-effort, failure is non-fatal */ }
        // Force refresh from server
        window.location.reload();
        // Return a pending promise while the page reloads
        return new Promise<{ default: React.ComponentType<P> }>(() => {});
      }

      // If already reloaded or not a chunk error, bubble up to ErrorBoundary
      throw error;
    }
  });
}
