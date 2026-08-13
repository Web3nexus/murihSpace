import { motion } from "motion/react";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router";
import { buttonVariants } from "../ui/button";
import { useCmsSingle } from "../../hooks/useCms";

interface CmsCta {
  headline: string;
  headline_accent: string;
  subcopy: string;
  primary_cta_label: string;
  primary_cta_href: string;
  secondary_cta_label: string;
  secondary_cta_href: string;
  fine_print: string;
}

const defaultCta: CmsCta = {
  headline: "Ready to build your",
  headline_accent: "creator empire",
  subcopy:
    "Join thousands of creators already using MurihSpace. Start free, no credit card required.",
  primary_cta_label: "Create your free account",
  primary_cta_href: "/register",
  secondary_cta_label: "See all features",
  secondary_cta_href: "/features",
  fine_print: "Free forever. No credit card needed.",
};

export function CTASection() {
  const { data: cta } = useCmsSingle<CmsCta>("cta", defaultCta);

  return (
    <section className="py-20 md:py-28 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-primary/10 via-primary/5 to-transparent pointer-events-none" />
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] opacity-60 pointer-events-none" style={{ background: "radial-gradient(circle, color-mix(in oklch, var(--color-primary) 10%, transparent), transparent)" }} />

      <div className="mx-auto max-w-7xl px-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.5 }}
          className="text-center max-w-2xl mx-auto"
        >
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
            {cta.headline}{" "}
            <span className="bg-gradient-to-r from-primary via-purple-500 to-pink-500 bg-clip-text text-transparent">
              {cta.headline_accent}
            </span>
            ?
          </h2>
          <p className="mt-4 text-muted-foreground text-lg">
            {cta.subcopy}
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to={cta.primary_cta_href}
              className={buttonVariants({ size: "lg", className: "h-12 px-8 text-base gap-2" })}
            >
              {cta.primary_cta_label}
              <ArrowRight className="size-4" />
            </Link>
            <Link
              to={cta.secondary_cta_href}
              className={buttonVariants({ variant: "outline", size: "lg", className: "h-12 px-8 text-base" })}
            >
              {cta.secondary_cta_label}
            </Link>
          </div>

          <p className="mt-4 text-xs text-muted-foreground">
            {cta.fine_print}
          </p>
        </motion.div>
      </div>
    </section>
  );
}
