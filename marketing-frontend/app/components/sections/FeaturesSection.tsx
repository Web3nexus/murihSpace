import { motion } from "motion/react";
import {
  Users, Store, MessageSquare, Wallet, ShieldCheck, Sparkles, Phone, ArrowRight
} from "lucide-react";
import { Link } from "react-router";
import { useCmsCollection } from "../../hooks/useCms";
import type { LucideIcon } from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  Users, Store, MessageSquare, Wallet, ShieldCheck, Sparkles, Phone,
};

export interface CmsFeature {
  title: string;
  description: string;
  icon: string;
  gradient?: string;
  icon_color?: string;
  image_url?: string;
}

const defaultFeatures: CmsFeature[] = [
  {
    icon: "Users",
    title: "Communities & Cohorts",
    description: "Launch public or private cohorts with channels, member roles, announcements, and group discussions.",
    gradient: "from-blue-500/20 to-cyan-500/20",
    icon_color: "text-[#2164B6]",
    image_url: "/images/creatorEve.webp",
  },
  {
    icon: "Store",
    title: "Creator Storefront",
    description: "Sell digital products, courses, coaching, and merch directly to your audience with milestone escrow.",
    gradient: "from-purple-500/20 to-pink-500/20",
    icon_color: "text-[#2164B6]",
    image_url: "/images/creatorEvent.png",
  },
  {
    icon: "MessageSquare",
    title: "Private Messaging & Audio",
    description: "Real-time Signal-encrypted chat with your supporters. 1-on-1 direct messages, voice notes, and 24-hour Stories.",
    gradient: "from-blue-500/20 to-sky-500/20",
    icon_color: "text-[#2164B6]",
    image_url: "/images/creator.png",
  },
  {
    icon: "Phone",
    title: "Live Calling & Stages",
    description: "Host HD group video calls, live audio stages with speaker queues, and interactive workshops with screen sharing.",
    gradient: "from-amber-500/20 to-orange-500/20",
    icon_color: "text-[#2164B6]",
    image_url: "/images/creatorEvent.png",
  },
  {
    icon: "ShieldCheck",
    title: "KYC Trust & Escrow",
    description: "Verified creator badges, end-to-end encryption by default, anti-fraud escrow, and full moderation controls.",
    gradient: "from-rose-500/20 to-red-500/20",
    icon_color: "text-[#2164B6]",
    image_url: "/images/creator.png",
  },
  {
    icon: "Sparkles",
    title: "Creator Studio & AI",
    description: "Murih AI copilot, curriculum generator, broadcast drafts, and real-time revenue analytics.",
    gradient: "from-indigo-500/20 to-violet-500/20",
    icon_color: "text-[#2164B6]",
    image_url: "/images/creatorEve.webp",
  },
];

export function FeaturesSection() {
  const { data: features } = useCmsCollection<CmsFeature>("features", defaultFeatures);

  return (
    <section className="bg-white py-20 md:py-28" id="features">
      <div className="mx-auto max-w-7xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.5 }}
          className="text-center max-w-3xl mx-auto mb-16"
        >
          <span className="text-xs font-bold uppercase tracking-wider text-[#2164B6] bg-[#E8F8FF] px-3.5 py-1.5 rounded-full mb-3 inline-block">
            Powerful Platform Tools
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#102840]">
            Everything you need to thrive as a creator
          </h2>
          <p className="mt-4 text-[#5A7184] text-lg">
            One platform. End-to-end encrypted. Infinite opportunities.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => {
            const Icon = ICONS[feature.icon] ?? Sparkles;
            return (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.4, delay: index * 0.08 }}
                className="group relative rounded-3xl border border-[#D6E0E8] bg-[#F7FAFC] overflow-hidden hover:shadow-xl hover:border-[#38A8D8] transition-all duration-300 flex flex-col"
              >
                {/* Feature Preview Image (Editable from backend) */}
                {feature.image_url && (
                  <div className="w-full aspect-[16/10] overflow-hidden bg-black/5">
                    <img
                      src={feature.image_url}
                      alt={feature.title}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  </div>
                )}

                <div className="p-6 flex flex-col flex-1">
                  <div className="inline-flex size-11 items-center justify-center rounded-2xl bg-[#E8F8FF] text-[#2164B6] mb-4">
                    <Icon className="size-5" />
                  </div>
                  <h3 className="font-bold text-xl text-[#102840] mb-2">{feature.title}</h3>
                  <p className="text-sm text-[#5A7184] leading-relaxed mb-4 flex-1">
                    {feature.description}
                  </p>
                  <Link
                    to="/features"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-[#2164B6] hover:text-[#38A8D8] transition-colors mt-auto"
                  >
                    <span>Learn more</span>
                    <ArrowRight className="size-3.5" />
                  </Link>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default FeaturesSection;
