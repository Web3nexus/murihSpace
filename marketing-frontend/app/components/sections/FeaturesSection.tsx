import { motion } from "motion/react";
import {
  Users, Store, MessageSquare, Wallet, ShieldCheck, Sparkles,
} from "lucide-react";
import { useCmsCollection } from "../../hooks/useCms";
import type { LucideIcon } from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  Users, Store, MessageSquare, Wallet, ShieldCheck, Sparkles,
};

interface CmsFeature {
  title: string;
  description: string;
  icon: string;
  gradient: string;
  icon_color: string;
}

const defaultFeatures: CmsFeature[] = [
  {
    icon: "Users",
    title: "Communities",
    description: "Build private or public communities. Share updates, host discussions, and grow your tribe.",
    gradient: "from-blue-500/20 to-cyan-500/20",
    icon_color: "text-blue-500",
  },
  {
    icon: "Store",
    title: "Storefront",
    description: "Sell digital products directly to your audience. No third-party fees, no hassle.",
    gradient: "from-purple-500/20 to-pink-500/20",
    icon_color: "text-purple-500",
  },
  {
    icon: "MessageSquare",
    title: "Messaging",
    description: "Real-time chat with your community. Direct messages and channel conversations.",
    gradient: "from-emerald-500/20 to-teal-500/20",
    icon_color: "text-emerald-500",
  },
  {
    icon: "Wallet",
    title: "Wallet & Payments",
    description: "Receive tips, donations, and payments. Withdraw when you want, where you want.",
    gradient: "from-amber-500/20 to-orange-500/20",
    icon_color: "text-amber-500",
  },
  {
    icon: "ShieldCheck",
    title: "Creator Safety",
    description: "Full moderation tools, KYC verification, and dispute resolution built in.",
    gradient: "from-rose-500/20 to-red-500/20",
    icon_color: "text-rose-500",
  },
  {
    icon: "Sparkles",
    title: "AI Tools",
    description: "Smart analytics, automated moderation, and growth insights powered by AI.",
    gradient: "from-indigo-500/20 to-violet-500/20",
    icon_color: "text-indigo-500",
  },
];

export function FeaturesSection() {
  const { data: features } = useCmsCollection<CmsFeature>("features", defaultFeatures);

  return (
    <section className="py-20 md:py-28" id="features">
      <div className="mx-auto max-w-7xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.5 }}
          className="text-center max-w-2xl mx-auto mb-16"
        >
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
            Everything you need to{" "}
            <span className="bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent">
              thrive as a creator
            </span>
          </h2>
          <p className="mt-4 text-muted-foreground text-lg">
            One platform. Zero complexity. Infinite possibilities.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((feature, index) => {
            const Icon = ICONS[feature.icon] ?? Sparkles;
            return (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.4, delay: index * 0.08 }}
                className="group relative rounded-xl border border-border/50 bg-background p-6 hover:border-border/80 hover:shadow-md transition-all"
              >
                <div className={`absolute inset-0 rounded-xl bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none`} />
                <div className="relative z-10">
                  <div className={`inline-flex size-10 items-center justify-center rounded-lg bg-muted ${feature.icon_color} mb-4`}>
                    <Icon className="size-5" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
