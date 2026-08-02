import { motion } from "motion/react";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router";
import { Button } from "../ui/button";

export function CTASection() {
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
            Ready to build your{" "}
            <span className="bg-gradient-to-r from-primary via-purple-500 to-pink-500 bg-clip-text text-transparent">
              creator empire
            </span>
            ?
          </h2>
          <p className="mt-4 text-muted-foreground text-lg">
            Join thousands of creators already using MurihSpace. Start free, no
            credit card required.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/register">
              <Button size="lg" className="h-12 px-8 text-base gap-2">
                Create your free account
                <ArrowRight className="size-4" />
              </Button>
            </Link>
            <Link to="/features">
              <Button variant="outline" size="lg" className="h-12 px-8 text-base">
                See all features
              </Button>
            </Link>
          </div>

          <p className="mt-4 text-xs text-muted-foreground">
            Free forever. No credit card needed.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
