import { Link } from "react-router";
import { AnimatedPage } from "@/components/common/AnimatedPage";
import { Button } from "@/components/ui/button";
import {
  Users,
  ShoppingBag,
  Wallet,
  Sparkles,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";

export function HomePage() {
  return (
    <AnimatedPage className="min-h-screen bg-background text-foreground flex flex-col justify-between">
      {/* Public Header Bar */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur-md px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-bold text-lg text-foreground">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold text-sm shadow-sm">
              M
            </div>
            <span>MurihSpace</span>
          </Link>

          <div className="flex items-center gap-4">
            <Link to="/login">
              <Button variant="ghost" size="sm" className="font-semibold">
                Sign In
              </Button>
            </Link>
            <Link to="/register">
              <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold gap-1">
                Get Started <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="px-6 py-20 md:py-28 max-w-5xl mx-auto text-center space-y-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-secondary/30 bg-secondary/10 text-secondary text-xs font-semibold">
          <Sparkles className="h-3.5 w-3.5" />
          <span>One Connected Creator Ecosystem</span>
        </div>

        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-foreground leading-tight">
          Community, Commerce, Payments & Growth. All in One Place.
        </h1>

        <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          MurihSpace combines public & private communities, creator storefronts, digital and physical products, instant payments, and milestone rewards under a single unified identity.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
          <Link to="/register">
            <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 px-8 text-base font-semibold shadow-md gap-2">
              Launch Your Workspace <ArrowRight className="h-5 w-5" />
            </Button>
          </Link>
          <Link to="/app">
            <Button size="lg" variant="outline" className="px-8 text-base font-semibold border-border">
              Console Preview
            </Button>
          </Link>
        </div>
      </section>

      {/* Product Pillars Section */}
      <section className="px-6 py-16 bg-muted/40 border-t border-b border-border">
        <div className="max-w-7xl mx-auto space-y-12">
          <div className="text-center space-y-2 max-w-xl mx-auto">
            <h2 className="text-2xl font-bold tracking-tight text-foreground">
              Built for Creators, Communities & Vendors
            </h2>
            <p className="text-sm text-muted-foreground">
              Four connected product modules sharing single sign-on, verified identity, and escrow payments.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Pillar 1 */}
            <div className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-4">
              <div className="p-3 rounded-xl bg-secondary/10 text-secondary w-fit">
                <Users className="h-6 w-6" />
              </div>
              <h3 className="font-bold text-lg text-foreground">MurihSpace Community</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Public and private spaces, member feeds, status updates, direct messaging, channels, and community events.
              </p>
            </div>

            {/* Pillar 2 */}
            <div className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-4">
              <div className="p-3 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 w-fit">
                <ShoppingBag className="h-6 w-6" />
              </div>
              <h3 className="font-bold text-lg text-foreground">MurihStore Marketplace</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Creator storefronts, digital downloads, physical products, inventory management, and escrow transaction protection.
              </p>
            </div>

            {/* Pillar 3 */}
            <div className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-4">
              <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 w-fit">
                <Wallet className="h-6 w-6" />
              </div>
              <h3 className="font-bold text-lg text-foreground">MurihPay Payments</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Instant checkout, wallet balances, P2P username transfers, QR payments, donations, and secure withdrawals.
              </p>
            </div>

            {/* Pillar 4 */}
            <div className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-4">
              <div className="p-3 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 w-fit">
                <Sparkles className="h-6 w-6" />
              </div>
              <h3 className="font-bold text-lg text-foreground">MurihSpace Milestones</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Community goals, revenue targets, product-sales goals, donation tracking, rewards, and growth analytics.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Trust & Identity Banner */}
      <section className="px-6 py-16 max-w-5xl mx-auto text-center space-y-6">
        <div className="p-8 rounded-2xl border border-border bg-card shadow-sm space-y-4">
          <div className="flex justify-center">
            <div className="p-3 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="h-8 w-8" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-foreground">Financially Clear & KYC Verified</h2>
          <p className="text-sm text-muted-foreground max-w-xl mx-auto">
            All creators and vendors pass identity verification (KYC). Physical purchases are protected by escrow, ensuring safety for buyers and merchants.
          </p>
          <div className="pt-2">
            <Link to="/register">
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold gap-2">
                Join MurihSpace Today <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Public Footer */}
      <footer className="border-t border-border bg-card px-6 py-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="font-bold text-foreground">MurihSpace</span>
            <span>© 2026 MurihSpace Ecosystem. All rights reserved.</span>
          </div>
          <div className="flex items-center gap-6">
            <Link to="/privacy" className="hover:text-foreground">Privacy Policy</Link>
            <Link to="/terms" className="hover:text-foreground">Terms of Service</Link>
            <Link to="/app" className="hover:text-foreground font-semibold text-secondary">Ecosystem Console</Link>
          </div>
        </div>
      </footer>
    </AnimatedPage>
  );
}
