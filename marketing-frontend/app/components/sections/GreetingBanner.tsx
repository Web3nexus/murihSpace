import { Shield, Sparkles, Store, Users, Radio, Lock } from "lucide-react";
import { useCmsSingle } from "../../hooks/useCms";

interface CmsGreetingBanner {
  multilingual_headline?: string;
}

const defaultGreeting: CmsGreetingBanner = {
  multilingual_headline:
    "Connect, teach, and transact with total confidence. MurihSpace unites creators, cohort members, and merchants in one secure home with built-in storefronts, interactive live audio stages, and smart escrow protection.",
};

export function GreetingBanner() {
  const { data: cmsGreeting } = useCmsSingle<CmsGreetingBanner>("homepage", defaultGreeting);
  const greeting = cmsGreeting ?? defaultGreeting;

  const ecosystemTags = [
    { label: "Cohort Masterclasses", icon: Users, color: "text-[#2164B6] bg-[#E8F8FF]" },
    { label: "Live Audio Stages", icon: Radio, color: "text-[#38A8D8] bg-[#E8F8FF]" },
    { label: "Verified Storefronts", icon: Store, color: "text-[#102840] bg-[#FAF9F5]" },
    { label: "Escrow Protection", icon: Shield, color: "text-[#2164B6] bg-[#E8F8FF]" },
    { label: "Murih AI Copilot", icon: Sparkles, color: "text-[#102840] bg-[#FAF9F5]" },
    { label: "Signal Protocol E2EE", icon: Lock, color: "text-[#38A8D8] bg-[#E8F8FF]" },
  ];

  return (
    <section className="greeting-banner">
      <div className="container-landing">
        <div className="greeting-banner-content">
          <h2 className="greeting-lead-text">
            {greeting.multilingual_headline ?? defaultGreeting.multilingual_headline}
          </h2>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3 max-w-3xl mx-auto">
            {ecosystemTags.map((tag) => {
              const Icon = tag.icon;
              return (
                <div
                  key={tag.label}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[#D6E0E8] font-semibold text-xs md:text-sm shadow-sm transition-transform hover:scale-105 ${tag.color}`}
                >
                  <Icon className="size-4 shrink-0" />
                  <span>{tag.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
