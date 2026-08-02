import { HeroSection } from "../components/sections/HeroSection";
import { FeaturesSection } from "../components/sections/FeaturesSection";
import { StatsSection } from "../components/sections/StatsSection";
import { TestimonialsSection } from "../components/sections/TestimonialsSection";
import { PricingSection } from "../components/sections/PricingSection";
import { CTASection } from "../components/sections/CTASection";

export function meta() {
  return [
    { title: "MurihSpace — The Creator Platform" },
    { name: "description", content: "Build, grow, and monetise your community. All in one place." },
  ];
}

export default function Home() {
  return (
    <>
      <HeroSection />
      <FeaturesSection />
      <StatsSection />
      <TestimonialsSection />
      <PricingSection />
      <CTASection />
    </>
  );
}
