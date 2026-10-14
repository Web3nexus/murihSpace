import { motion } from "motion/react";
import { ArrowRight, LogIn } from "lucide-react";
import { Link } from "react-router";
import { useCmsSingle } from "../../hooks/useCms";
import { getLoginUrl } from "~/lib/env";

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
  headline: "Ready to connect and build your",
  headline_accent: "creator community",
  subcopy:
    "Join thousands of creators already using MurihSpace. Create your account in the mobile app, then sign in on the web.",
  primary_cta_label: "Download the App",
  primary_cta_href: "/download",
  secondary_cta_label: "Sign In",
  secondary_cta_href: "/login",
  fine_print: "Free forever. End-to-end encrypted. No credit card needed.",
};

export function CTASection() {
  const { data: cta } = useCmsSingle<CmsCta>("cta", defaultCta);

  // Sign in lives on the web app, not the marketing site, so resolve the
  // default marketing path to the real login URL (CMS overrides pass through).
  const secondaryHref =
    cta.secondary_cta_href === "/login" ? getLoginUrl() : cta.secondary_cta_href;

  return (
    <section className="bg-[#102840] text-white py-20 md:py-28 relative overflow-hidden text-center">
      <div className="mx-auto max-w-4xl px-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.5 }}
          className="flex flex-col items-center"
        >
          <span className="text-xs font-bold uppercase tracking-wider text-[#38A8D8] bg-white/10 px-3.5 py-1.5 rounded-full mb-6">
            Get Started in Seconds
          </span>

          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-white leading-tight">
            {cta.headline}{" "}
            <span className="text-[#38A8D8] block sm:inline">
              {cta.headline_accent}
            </span>
          </h2>

          <p className="mt-5 text-lg text-[#B7C6D1] max-w-xl">
            {cta.subcopy}
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to={cta.primary_cta_href}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[#38A8D8] px-8 text-base font-bold text-[#081827] shadow-lg hover:bg-[#2692c0] hover:text-white transition-all hover:-translate-y-0.5"
            >
              <span>{cta.primary_cta_label}</span>
              <ArrowRight className="size-4" />
            </Link>
            <a
              href={secondaryHref}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-white/40 px-8 text-base font-semibold text-white hover:bg-white/10 transition-colors"
            >
              <span>{cta.secondary_cta_label}</span>
              <LogIn className="size-4" />
            </a>
          </div>

          <p className="mt-6 text-xs text-[#8696A0]">
            {cta.fine_print}
          </p>
        </motion.div>
      </div>
    </section>
  );
}

export default CTASection;
