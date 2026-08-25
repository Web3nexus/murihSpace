import { FeaturesSection } from "../components/sections/FeaturesSection";
import { CTASection } from "../components/sections/CTASection";
import { HeroSection } from "../components/sections/HeroSection";

export function meta() {
  return [
    { title: "Features — MurihSpace" },
    { name: "description", content: "Everything you need to build, grow, and monetise your creator business." },
  ];
}

export default function Features() {
  return (
    <>
      <HeroSection />
      <FeaturesSection />
      <CTASection />
    </>
  );
}
