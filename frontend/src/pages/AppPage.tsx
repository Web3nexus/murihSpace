import { Link } from "react-router";
import { AnimatedPage } from "@/components/common/AnimatedPage";
import { Button } from "@/components/ui/button";
import {
  TrendingUp,
  Users,
  ShoppingBag,
  Wallet,
  Sparkles,
  ArrowUpRight,
  Plus,
  MessageSquare,
  ShieldCheck,
} from "lucide-react";

export function AppPage() {
  return (
    <AnimatedPage className="space-y-8 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Creator Dashboard Overview
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Welcome back, Vincent! Here is your ecosystem overview across MurihSpace, MurihStore & MurihPay.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/app/messages">
            <Button variant="outline" size="sm" className="gap-2">
              <MessageSquare className="h-4 w-4 text-secondary" />
              Community Chat
            </Button>
          </Link>
          <Link to="/app/settings">
            <Button size="sm" className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
              <Plus className="h-4 w-4" />
              Create Post
            </Button>
          </Link>
        </div>
      </div>

      {/* Metric Cards Grid (Stripe-inspired Financial & Growth Metrics) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <div className="rounded-xl border border-border bg-card p-5 text-card-foreground shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Total Earnings
            </span>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Wallet className="h-4 w-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold text-foreground">£12,450.80</div>
            <div className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 mt-1 font-medium">
              <TrendingUp className="h-3.5 w-3.5" /> +14.2% from last month
            </div>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="rounded-xl border border-border bg-card p-5 text-card-foreground shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Active Members
            </span>
            <div className="p-2 rounded-lg bg-secondary/10 text-secondary">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold text-foreground">1,842</div>
            <div className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 mt-1 font-medium">
              <TrendingUp className="h-3.5 w-3.5" /> +120 new this week
            </div>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="rounded-xl border border-border bg-card p-5 text-card-foreground shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Store Sales
            </span>
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <ShoppingBag className="h-4 w-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold text-foreground">348 Orders</div>
            <div className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 mt-1 font-medium">
              <TrendingUp className="h-3.5 w-3.5" /> 98% fulfillment rate
            </div>
          </div>
        </div>

        {/* Metric 4 */}
        <div className="rounded-xl border border-border bg-card p-5 text-card-foreground shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Milestone Progress
            </span>
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <Sparkles className="h-4 w-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold text-foreground">82%</div>
            <div className="text-xs text-muted-foreground mt-1 font-medium">
              Goal: £15,000 / month
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Activity & Growth */}
        <div className="lg:col-span-2 space-y-6">
          {/* Milestones Card */}
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div>
                <h3 className="font-bold text-foreground text-base">Community Milestones & Analytics</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Track goal progression and community engagement targets.
                </p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-secondary/10 text-secondary">
                Active Goal
              </span>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between text-xs font-medium">
                <span className="text-foreground">Monthly Recurring Membership Revenue</span>
                <span className="text-muted-foreground">£8,200 of £10,000</span>
              </div>
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-secondary transition-all" style={{ width: "82%" }} />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 pt-2">
              <div className="p-3 rounded-lg border border-border bg-muted/30">
                <span className="text-[11px] text-muted-foreground block">Donations</span>
                <span className="text-sm font-bold text-foreground mt-1 block">£1,420</span>
              </div>
              <div className="p-3 rounded-lg border border-border bg-muted/30">
                <span className="text-[11px] text-muted-foreground block">Store Escrow</span>
                <span className="text-sm font-bold text-foreground mt-1 block">£2,830</span>
              </div>
              <div className="p-3 rounded-lg border border-border bg-muted/30">
                <span className="text-[11px] text-muted-foreground block">Events Booked</span>
                <span className="text-sm font-bold text-foreground mt-1 block">14 Slots</span>
              </div>
            </div>
          </div>

          {/* Recent Activity Table */}
          <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <h3 className="font-bold text-foreground text-base">Recent Ecosystem Activity</h3>
              <Link to="/app/messages" className="text-xs font-semibold text-secondary hover:underline flex items-center gap-0.5">
                View All <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="divide-y divide-border text-xs">
              <div className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-secondary/10 flex items-center justify-center font-bold text-secondary text-xs">
                    JD
                  </div>
                  <div>
                    <span className="font-semibold text-foreground block">John Doe joined MurihArt Community</span>
                    <span className="text-muted-foreground text-[11px]">2 minutes ago</span>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold text-[10px]">
                  Member
                </span>
              </div>

              <div className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-amber-500/10 flex items-center justify-center font-bold text-amber-600 text-xs">
                    AS
                  </div>
                  <div>
                    <span className="font-semibold text-foreground block">Alice Smith purchased Digital Art Pack</span>
                    <span className="text-muted-foreground text-[11px]">45 minutes ago</span>
                  </div>
                </div>
                <span className="font-mono font-bold text-foreground">+£45.00</span>
              </div>

              <div className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-xs">
                    VP
                  </div>
                  <div>
                    <span className="font-semibold text-foreground block">Identity Verification (KYC) Verified</span>
                    <span className="text-muted-foreground text-[11px]">3 hours ago</span>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold text-[10px] flex items-center gap-1">
                  <ShieldCheck className="h-3 w-3" /> Verified
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right 1 Col: Quick Tools & Status */}
        <div className="space-y-6">
          {/* Quick Ecosystem Launcher */}
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-4">
            <h3 className="font-bold text-foreground text-base">Quick Navigation</h3>
            <div className="space-y-2">
              <Link
                to="/app/discover"
                className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted transition-colors text-xs font-medium text-foreground"
              >
                <span>Discover Communities</span>
                <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" />
              </Link>
              <Link
                to="/app/communities"
                className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted transition-colors text-xs font-medium text-foreground"
              >
                <span>Your Communities</span>
                <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" />
              </Link>
              <Link
                to="/app/store"
                className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted transition-colors text-xs font-medium text-foreground"
              >
                <span>Storefront & Orders</span>
                <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" />
              </Link>
              <Link
                to="/app/messages"
                className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted transition-colors text-xs font-medium text-foreground"
              >
                <span>Community Chat</span>
                <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" />
              </Link>
              <Link
                to="/app/settings"
                className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted transition-colors text-xs font-medium text-foreground"
              >
                <span>Profile & Verification</span>
                <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" />
              </Link>
              <Link
                to="/app/admin"
                className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted transition-colors text-xs font-medium text-foreground"
              >
                <span>Admin KYC Queue</span>
                <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </AnimatedPage>
  );
}
