import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Search, UserPlus, Shield, Settings } from "lucide-react";

interface StoredAdvertiser {
  id: number;
  business_name: string | null;
  currency: string | null;
  timezone: string | null;
  verification_status: string | null;
}

/** Advertiser record saved at sign-in. Nothing here is sample data. */
function readAdvertiser(): StoredAdvertiser | null {
  try {
    const raw = window.localStorage.getItem("ads_advertiser");
    return raw ? (JSON.parse(raw) as StoredAdvertiser) : null;
  } catch {
    return null;
  }
}

const EMPTY = "No data yet";

export default function BusinessIndex() {
  const [advertiser, setAdvertiser] = useState<StoredAdvertiser | null>(null);

  useEffect(() => {
    setAdvertiser(readAdvertiser());
  }, []);

  return (
    <div className="flex flex-col gap-6 max-w-[1400px] mx-auto w-full">
      {/* Header & Controls */}
      <div className="flex items-center justify-between border-b pb-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-800 dark:text-slate-100">Business Settings</h2>
          <p className="text-sm text-muted-foreground mt-1">Manage your ad account details, permissions, and team members.</p>
        </div>
      </div>

      {/* Settings Grid */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Ad Account Info */}
        <Card className="col-span-1 rounded-sm border-slate-200 dark:border-slate-800 shadow-none bg-slate-50 dark:bg-slate-900/50">
          <CardHeader className="pb-4 border-b border-slate-200 dark:border-slate-800">
            <CardTitle className="text-base font-semibold">Ad Account Info</CardTitle>
            <CardDescription>Primary settings for this account.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">Account Name</p>
              <p className="font-medium text-slate-800 dark:text-slate-200">{advertiser?.business_name || EMPTY}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">Account ID</p>
              <p className="font-mono text-sm text-slate-600">{advertiser ? advertiser.id : EMPTY}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">Currency & Timezone</p>
              <p className="text-sm text-slate-600">
                {advertiser?.currency && advertiser?.timezone
                  ? `${advertiser.currency} • ${advertiser.timezone}`
                  : EMPTY}
              </p>
            </div>
            <div className="pt-2">
              <Button variant="outline" size="sm" className="w-full rounded-sm bg-white dark:bg-slate-950" disabled>
                <Settings className="h-4 w-4 mr-2" /> Edit Details
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Verification Status */}
        <Card className="col-span-2 rounded-sm border-slate-200 dark:border-slate-800 shadow-none">
          <CardHeader className="pb-4 border-b border-slate-100 dark:border-slate-800">
            <CardTitle className="text-base font-semibold flex items-center">
              <Shield className="h-5 w-5 mr-2 text-primary" /> Verification Center
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">Verification Status</p>
              <p className="font-medium text-slate-800 dark:text-slate-200">
                {advertiser?.verification_status ? advertiser.verification_status.replace(/_/g, " ") : EMPTY}
              </p>
              <p className="text-sm text-muted-foreground">
                Spend limit data is not available yet.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Team Members */}
      <div className="flex flex-col gap-0 w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-sm mt-4">
        {/* Control Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-slate-800 dark:text-slate-200 mr-4">Team Members</h3>
            <div className="relative">
              <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search by name"
                disabled
                className="h-8 pl-8 w-full sm:w-[250px] rounded-sm bg-white dark:bg-slate-950 border-slate-200"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button className="rounded-sm h-8 bg-primary hover:bg-primary/90" disabled>
              <UserPlus className="h-4 w-4 mr-2" /> Invite Member
            </Button>
          </div>
        </div>

        <div className="p-8 text-center text-sm text-muted-foreground">
          No team members yet. Member management is not available in Ads Manager yet.
        </div>
      </div>
    </div>
  );
}
