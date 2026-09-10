import * as React from "react";
import { useRouteError, Link } from "react-router";
import {
  WarningCircle,
  ArrowsClockwise,
  House,
  Sparkle,
  VideoCameraSlash,
  WifiSlash,
  LockKey,
  Copy,
  Check,
  CaretDown,
  CaretUp,
  SignIn,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { mapApplicationError } from "@/lib/errorMapper";

export function RootErrorBoundary() {
  const error = useRouteError();
  const [showDetails, setShowDetails] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  const mapped = React.useMemo(() => mapApplicationError(error), [error]);

  const handleReload = () => {
    try {
      sessionStorage.clear();
    } catch (_) {}
    window.location.reload();
  };

  const handleCopyDiagnostics = () => {
    const diagnostics = `Error: ${mapped.title}\nCategory: ${mapped.category}\nDetails: ${mapped.rawMessage}\n\nStack:\n${mapped.stack || "N/A"}\n\nURL: ${window.location.href}\nTime: ${new Date().toISOString()}`;
    navigator.clipboard.writeText(diagnostics);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const renderIcon = () => {
    switch (mapped.iconType) {
      case "livekit":
        return (
          <div className="h-16 w-16 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500 mx-auto">
            <VideoCameraSlash weight="fill" className="h-8 w-8" />
          </div>
        );
      case "network":
        return (
          <div className="h-16 w-16 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-500 mx-auto">
            <WifiSlash weight="fill" className="h-8 w-8" />
          </div>
        );
      case "auth":
        return (
          <div className="h-16 w-16 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500 mx-auto">
            <LockKey weight="fill" className="h-8 w-8" />
          </div>
        );
      case "chunk":
        return (
          <div className="h-16 w-16 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500 mx-auto">
            <Sparkle weight="fill" className="h-8 w-8" />
          </div>
        );
      default:
        return (
          <div className="h-16 w-16 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500 mx-auto">
            <WarningCircle weight="fill" className="h-8 w-8" />
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 sm:p-6 bg-background text-foreground">
      <div className="w-full max-w-md p-6 sm:p-8 bg-card rounded-2xl border border-border/70 shadow-xl flex flex-col items-center text-center">
        {/* Clean Social App Icon */}
        <div className="mb-4">{renderIcon()}</div>

        {/* Title */}
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground mb-2">
          {mapped.title}
        </h1>

        {/* Human, Friendly Description */}
        <p className="text-sm text-muted-foreground leading-relaxed mb-6 max-w-sm">
          {mapped.description}
        </p>

        {/* Action Buttons (Social App Style) */}
        <div className="flex flex-col sm:flex-row gap-2.5 w-full">
          {mapped.category === "auth" ? (
            <Link
              to="/login"
              className="flex-1 inline-flex items-center justify-center gap-2 h-11 px-5 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-all text-sm"
            >
              <SignIn weight="bold" className="h-4 w-4" />
              <span>{mapped.actionLabel}</span>
            </Link>
          ) : (
            <Button
              onClick={handleReload}
              className="flex-1 inline-flex items-center justify-center gap-2 h-11 px-5 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-all text-sm"
            >
              <ArrowsClockwise weight="bold" className="h-4 w-4" />
              <span>{mapped.actionLabel}</span>
            </Button>
          )}

          <Link
            to="/app/feed"
            className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-xl border border-border bg-muted/40 hover:bg-muted text-foreground font-medium transition-all text-sm"
          >
            <House weight="fill" className="h-4 w-4 text-muted-foreground" />
            <span>Go to Feed</span>
          </Link>
        </div>

        {/* Technical Diagnostics - Strictly DEV ONLY */}
        {import.meta.env.DEV && (
          <div className="w-full pt-4 mt-6 border-t border-border/50 text-left">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setShowDetails(!showDetails)}
                className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 font-medium transition-colors"
              >
                <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 font-bold text-[9px] uppercase tracking-wider font-mono">
                  Dev Only
                </span>
                <span>Diagnostic details</span>
                {showDetails ? <CaretUp className="h-3 w-3" /> : <CaretDown className="h-3 w-3" />}
              </button>

              {showDetails && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleCopyDiagnostics}
                  className="h-6 text-[11px] gap-1 px-2 text-muted-foreground hover:text-foreground"
                >
                  {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                  <span>{copied ? "Copied" : "Copy"}</span>
                </Button>
              )}
            </div>

            {showDetails && (
              <div className="mt-2.5 p-3 rounded-xl bg-muted/70 border border-border text-[11px] font-mono text-muted-foreground overflow-x-auto max-h-40 space-y-1">
                <p className="text-destructive font-semibold">{mapped.rawMessage}</p>
                {mapped.stack && (
                  <pre className="text-[10px] whitespace-pre-wrap leading-tight text-muted-foreground/75">
                    {mapped.stack.split("\n").slice(0, 8).join("\n")}
                  </pre>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default RootErrorBoundary;
