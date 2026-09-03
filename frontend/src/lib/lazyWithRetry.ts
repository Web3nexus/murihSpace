import type React from "react";
import { lazy } from "react";

/**
 * Lazy loads a component with automated chunk loading retry.
 * If a new deployment has taken place and the browser attempts to load
 * a stale chunk hash (resulting in a 404 / Failed to fetch dynamically imported module),
 * this helper intercepts the failure, saves a reload flag to prevent loops, and reloads
 * the page so the browser receives the newest index.html and chunk manifests.
 */
export function lazyWithRetry<T extends React.ComponentType<any>>(
  factory: () => Promise<{ default: T } | Record<string, any>>,
  namedExport?: string
): React.LazyExoticComponent<T> {
  return lazy(async () => {
    try {
      const module: Record<string, any> = await factory();
      // On successful module load, clear the reload flag
      try {
        sessionStorage.removeItem("chunk_reload_attempted");
      } catch (_) {}

      if (namedExport && module[namedExport]) {
        return { default: module[namedExport] as T };
      }
      if ("default" in module && module.default) {
        return { default: module.default as T };
      }
      return { default: module as unknown as T };
    } catch (error: any) {
      const errorMessage = error?.message || String(error);
      const isChunkError =
        errorMessage.includes("Failed to fetch dynamically imported module") ||
        errorMessage.includes("Importing a module script failed") ||
        errorMessage.includes("error loading dynamically imported module") ||
        errorMessage.includes("ChunkLoadError") ||
        errorMessage.includes("Loading chunk");

      let reloadAttempted = false;
      try {
        reloadAttempted = !!sessionStorage.getItem("chunk_reload_attempted");
      } catch (_) {}

      if (isChunkError && !reloadAttempted) {
        try {
          sessionStorage.setItem("chunk_reload_attempted", "true");
        } catch (_) {}
        // Force refresh from server
        window.location.reload();
        // Return a pending promise while the page reloads
        return new Promise<{ default: T }>(() => {});
      }

      // If already reloaded or not a chunk error, bubble up to ErrorBoundary
      throw error;
    }
  });
}
