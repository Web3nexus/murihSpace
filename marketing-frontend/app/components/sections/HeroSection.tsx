import { motion } from "motion/react";
import { ArrowRight, Sparkles } from "lucide-react";
import { buttonVariants } from "../ui/button";
import { Link } from "react-router";
import { useCmsSingle } from "../../hooks/useCms";

interface CmsHomepage {
  badge: string;
  headline: string;
  headline_accent: string;
  subcopy: string;
  primary_cta_label: string;
  primary_cta_href: string;
  secondary_cta_label: string;
  secondary_cta_href: string;
  creators_badge: string;
}

const defaultHomepage: CmsHomepage = {
  badge: "Built for creators, by creators",
  headline: "Your audience deserves",
  headline_accent: "more than a link",
  subcopy:
    "MurihSpace gives creators everything they need to build, grow, and monetise — communities, storefronts, messaging, and payments, all in one place.",
  primary_cta_label: "Start building for free",
  primary_cta_href: "/register",
  secondary_cta_label: "See creator stories",
  secondary_cta_href: "/creators",
  creators_badge: "2,400+ creators joined this month",
};

export function HeroSection() {
  const { data: home } = useCmsSingle<CmsHomepage>("homepage", defaultHomepage);

  return (
    <section className="relative overflow-hidden pt-24 pb-20 md:pt-32 md:pb-28">
      <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent pointer-events-none" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] opacity-60 pointer-events-none" style={{ background: "radial-gradient(circle, color-mix(in oklch, var(--color-primary) 8%, transparent), transparent)" }} />

      <div className="mx-auto max-w-7xl px-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="flex flex-col items-center text-center max-w-3xl mx-auto"
        >
          <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-4 py-1.5 text-sm text-muted-foreground mb-8">
            <Sparkles className="size-3.5 text-primary" />
            <span>{home.badge}</span>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1]">
            <span className="text-foreground">{home.headline} </span>
            <span className="bg-gradient-to-r from-primary via-purple-500 to-pink-500 bg-clip-text text-transparent">
              {home.headline_accent}
            </span>
          </h1>

          <p className="mt-6 text-lg text-muted-foreground max-w-xl leading-relaxed">
            {home.subcopy}
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center gap-4">
            <Link
              to={home.primary_cta_href}
              className={buttonVariants({ size: "lg", className: "h-11 px-6 text-base gap-2" })}
            >
              {home.primary_cta_label}
              <ArrowRight className="size-4" />
            </Link>
            <Link
              to={home.secondary_cta_href}
              className={buttonVariants({ variant: "outline", size: "lg", className: "h-11 px-6 text-base" })}
            >
              {home.secondary_cta_label}
            </Link>
          </div>

          <div className="mt-10 flex items-center gap-6 text-sm text-muted-foreground">
            <div className="flex -space-x-2">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="size-8 rounded-full border-2 border-background bg-gradient-to-br from-primary/30 to-purple-500/30"
                />
              ))}
            </div>
            <span>{home.creators_badge}</span>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mt-16 relative"
        >
          <div className="relative mx-auto max-w-4xl rounded-2xl border border-border/50 bg-gradient-to-b from-muted/50 to-background p-2 shadow-2xl">
            <div className="rounded-xl overflow-hidden bg-background/50 backdrop-blur-sm">
              <div className="flex items-center gap-1.5 border-b border-border/50 px-4 py-3">
                <div className="size-2.5 rounded-full bg-red-500/70" />
                <div className="size-2.5 rounded-full bg-amber-500/70" />
                <div className="size-2.5 rounded-full bg-green-500/70" />
                <div className="ml-3 text-xs text-muted-foreground/60 font-mono">
                  murihspace.com/dashboard
                </div>
              </div>
              <div className="grid grid-cols-3 gap-px bg-border/30 p-4">
                <div className="col-span-2 rounded-lg bg-muted/30 p-4 space-y-3">
                  <div className="h-4 w-32 rounded bg-muted/50" />
                  <div className="h-3 w-full rounded bg-muted/30" />
                  <div className="h-3 w-3/4 rounded bg-muted/30" />
                  <div className="flex gap-2 pt-2">
                    <div className="h-8 w-20 rounded-lg bg-primary/20" />
                    <div className="h-8 w-24 rounded-lg bg-muted/50" />
                  </div>
                </div>
                <div className="rounded-lg bg-muted/30 p-4 space-y-3">
                  <div className="h-4 w-20 rounded bg-muted/50" />
                  <div className="h-8 w-full rounded-lg bg-gradient-to-br from-primary/20 to-purple-500/20" />
                  <div className="h-8 w-full rounded-lg bg-muted/40" />
                  <div className="h-8 w-full rounded-lg bg-muted/40" />
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
