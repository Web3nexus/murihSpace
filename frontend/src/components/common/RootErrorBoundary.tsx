import { useRouteError, isRouteErrorResponse, Link } from "react-router";
import { AlertTriangle, RefreshCw, Home, Sparkles } from "lucide-react";

export function RootErrorBoundary() {
  const error = useRouteError();

  const errorMessage = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
    ? error.message
    : typeof error === "string"
    ? error
    : "An unexpected application error occurred.";

  const isChunkError =
    errorMessage.includes("Failed to fetch dynamically imported module") ||
    errorMessage.includes("Importing a module script failed") ||
    errorMessage.includes("error loading dynamically imported module") ||
    errorMessage.includes("ChunkLoadError") ||
    errorMessage.includes("Loading chunk");

  const handleHardRefresh = () => {
    // Clear cache keys and force reload from server
    try {
      sessionStorage.clear();
    } catch (_) {}
    window.location.reload();
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-background text-foreground">
      <div className="w-full max-w-md p-6 sm:p-8 bg-card rounded-2xl border border-border/80 shadow-2xl text-center flex flex-col items-center">
        <div className="h-16 w-16 rounded-full bg-amber-500/10 dark:bg-amber-400/10 flex items-center justify-center mb-5 text-amber-600 dark:text-amber-400">
          {isChunkError ? (
            <Sparkles className="h-8 w-8 animate-pulse text-primary" />
          ) : (
            <AlertTriangle className="h-8 w-8" />
          )}
        </div>

        <h1 className="text-xl sm:text-2xl font-black tracking-tight mb-2">
          {isChunkError ? "Application Updated" : "Unexpected Error"}
        </h1>

        <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
          {isChunkError
            ? "A newer version of MurihSpace is available. Please refresh to load the latest features and security updates."
            : errorMessage}
        </p>

        <div className="flex flex-col sm:flex-row gap-3 w-full">
          <button
            onClick={handleHardRefresh}
            className="flex-1 inline-flex items-center justify-center gap-2 h-11 px-4 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-all shadow-sm"
          >
            <RefreshCw className="h-4 w-4" />
            {isChunkError ? "Update Now" : "Reload Page"}
          </button>

          <Link
            to="/"
            className="inline-flex items-center justify-center gap-2 h-11 px-4 rounded-xl border border-border bg-muted/40 hover:bg-muted font-medium transition-all"
          >
            <Home className="h-4 w-4" />
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}
