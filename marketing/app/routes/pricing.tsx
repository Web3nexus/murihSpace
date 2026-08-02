import { PricingSection } from "../components/sections/PricingSection";
import { CTASection } from "../components/sections/CTASection";

export function meta() {
  return [
    { title: "Pricing — MurihSpace" },
    { name: "description", content: "Simple, transparent pricing for creators of all sizes." },
  ];
}

export default function Pricing() {
  return (
    <>
      <PricingSection />
      <CTASection />
    </>
  );
}
