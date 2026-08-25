import { HeroSection } from "../components/sections/HeroSection";
import { FeaturesSection } from "../components/sections/FeaturesSection";
import { StatsSection } from "../components/sections/StatsSection";
import { TestimonialsSection } from "../components/sections/TestimonialsSection";
import { PricingSection } from "../components/sections/PricingSection";
import { CTASection } from "../components/sections/CTASection";
import { fetchCmsSection } from "../lib/cms";

export async function loader() {
  const seo = await fetchCmsSection("seo");
  const defaults = seo?.[0]?.content as { default_title?: string; default_description?: string } | null;
  return {
    seoTitle: defaults?.default_title ?? "MurihSpace | The Creator Platform",
    seoDescription: defaults?.default_description ?? "Build your community, sell digital & physical goods, process payments, and scale your business.",
  };
}

export function meta({ loaderData }: { loaderData: { seoTitle: string; seoDescription: string } }) {
  return [
    { title: loaderData?.seoTitle ?? "MurihSpace | The Creator Platform" },
    { name: "description", content: loaderData?.seoDescription ?? "Build, grow, and monetise your community. All in one place." },
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
