import { Navigate } from "react-router";
import { Megaphone, Target } from "@/components/icons/rounded";
import { Button } from "@/components/ui/button";
import { getAdsManagerHref } from "@/lib/adsManager";

/**
 * Entry point for the Ads Manager. The campaign tools live in the separate Ads
 * Manager app, which opens in a new tab. Email broadcasts and sequences are not
 * part of this entry point.
 */
export default function MarketingPage() {
  const adsManagerHref = getAdsManagerHref();

  // No usable address configured: there is nothing to open, so leave the page.
  if (!adsManagerHref) {
    return <Navigate to="/app" replace />;
  }

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6 p-4 lg:p-5">
      <div className="flex items-center gap-3 pb-2 border-b border-border/40">
        <Megaphone weight="fill" className="h-5 w-5 text-primary" />
        <div>
          <h1 className="text-lg font-extrabold text-foreground">Ads Manager</h1>
          <p className="text-xs font-medium text-muted-foreground">
            Create, fund and track paid ad campaigns.
          </p>
        </div>
      </div>

      <div className="rounded-lg border-none/60 bg-card p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="h-11 w-11 rounded-lg bg-[var(--shell-accent-solid)]/10 flex items-center justify-center shrink-0">
            <Target weight="fill" className="h-5 w-5 text-[var(--shell-accent)]" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-bold text-foreground">Campaigns, budgets and audiences</p>
            <p className="text-xs font-medium text-muted-foreground leading-relaxed">
              The Ads Manager opens in a new tab so your current work stays where it is.
            </p>
          </div>
        </div>
        <Button asChild size="sm" className="bg-[var(--shell-accent-solid)] hover:bg-[var(--shell-accent-hover)] text-white font-bold">
          <a href={adsManagerHref} target="_blank" rel="noopener noreferrer">
            Open Ads Manager
          </a>
        </Button>
      </div>
    </div>
  );
}
