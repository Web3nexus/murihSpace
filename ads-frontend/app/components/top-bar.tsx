import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { Bell, Building, ExternalLink, HelpCircle, Menu, Plus, User } from "lucide-react";
import { Button } from "./ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "./ui/sheet";
import { SideNavContent } from "./side-nav";
import { DATE_RANGE_OPTIONS, parseRange, type DateRangeValue } from "~/lib/date-range";
import { mainAppUrl } from "~/lib/ads-api";

interface StoredAccount {
  name: string;
  advertiserId: string;
}

function readAccount(): StoredAccount {
  const fallback: StoredAccount = { name: "Advertiser", advertiserId: "" };
  try {
    const advertiser = JSON.parse(window.localStorage.getItem("ads_advertiser") || "null");
    const user = JSON.parse(window.localStorage.getItem("ads_user") || "null");
    return {
      name: advertiser?.business_name || user?.name || fallback.name,
      advertiserId: window.localStorage.getItem("advertiser_id") || "",
    };
  } catch {
    return fallback;
  }
}

export function TopBar() {
  const [params, setParams] = useSearchParams();
  const range = parseRange(params.get("range"));
  const [navOpen, setNavOpen] = useState(false);
  const [account, setAccount] = useState<StoredAccount>({ name: "Advertiser", advertiserId: "" });

  // Read per-viewer storage after mount so server and client markup match.
  useEffect(() => {
    setAccount(readAccount());
  }, []);

  function updateRange(value: DateRangeValue) {
    const next = new URLSearchParams(params);
    next.set("range", value);
    setParams(next, { replace: true });
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:text-sm focus:shadow-md"
      >
        Skip to content
      </a>
      <div className="flex min-h-14 flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2 md:px-4">
        <Sheet open={navOpen} onOpenChange={setNavOpen}>
          <SheetTrigger
            render={<Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation" />}
          >
            <Menu className="h-5 w-5" />
          </SheetTrigger>
          <SheetContent side="left" className="w-72 max-w-[85vw] p-0">
            <SheetHeader className="border-b border-border px-4 py-3">
              <SheetTitle>Ads Manager</SheetTitle>
              <SheetDescription>Sections and tools</SheetDescription>
            </SheetHeader>
            <SideNavContent onNavigate={() => setNavOpen(false)} />
          </SheetContent>
        </Sheet>

        <Link to="/" className="flex items-center gap-2 rounded-sm focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
          <img src="/logos/member-icon-light.png" alt="" className="h-7 w-7 shrink-0 object-contain dark:hidden" />
          <img src="/logos/member-icon-dark.png" alt="" className="hidden h-7 w-7 shrink-0 object-contain dark:block" />
          <span className="text-base font-semibold tracking-tight text-foreground">Ads Manager</span>
        </Link>

        <div className="flex items-center gap-2">
          <label htmlFor="ad-account" className="sr-only">
            Ad account
          </label>
          <select
            id="ad-account"
            value={account.advertiserId}
            onChange={() => undefined}
            className="h-8 max-w-[11rem] truncate rounded-lg border border-input bg-transparent px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
          >
            <option value={account.advertiserId} className="bg-background">
              {account.name}
              {account.advertiserId ? ` (${account.advertiserId})` : ""}
            </option>
          </select>

          <label htmlFor="date-range" className="sr-only">
            Date range
          </label>
          <select
            id="date-range"
            value={range}
            onChange={(e) => updateRange(e.target.value as DateRangeValue)}
            className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
          >
            {DATE_RANGE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value} className="bg-background">
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <Button render={<Link to="/campaigns/create/objective" />} className="h-8 px-3">
            <Plus className="h-4 w-4" aria-hidden="true" />
            Create
          </Button>

          <div className="hidden items-center gap-1 md:flex">
            <Button variant="ghost" size="icon" className="text-muted-foreground" aria-label="Help and support">
              <HelpCircle className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" className="text-muted-foreground" aria-label="Notifications">
              <Bell className="h-5 w-5" />
            </Button>
            <Link
              to="/business"
              className="ml-1 hidden items-center gap-1.5 rounded-sm text-sm font-medium text-muted-foreground transition-colors hover:text-foreground xl:flex"
            >
              <Building className="h-4 w-4" aria-hidden="true" />
              Business Center
            </Link>
          </div>

          <a
            href={`${mainAppUrl()}/app`}
            className="hidden rounded-lg bg-muted px-2.5 py-1 text-xs font-semibold text-foreground transition-colors hover:text-ads-accent-text lg:inline-block"
          >
            MurihSpace App
          </a>

          <div className="hidden text-right sm:block">
            <div className="text-sm font-medium leading-none">{account.name}</div>
            {account.advertiserId && <div className="mt-1 text-xs text-muted-foreground">ID: {account.advertiserId}</div>}
          </div>
          <Button variant="outline" size="icon" className="h-8 w-8 rounded-full" aria-label="User profile">
            <User className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" render={<Link to="/secureads/login" />} aria-label="Secure Ads admin">
            <ExternalLink className="h-4 w-4 text-red-500" />
          </Button>
        </div>
      </div>
    </header>
  );
}
