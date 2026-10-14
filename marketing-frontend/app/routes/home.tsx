import { HeroSection } from "../components/sections/HeroSection";
import { GreetingBanner } from "../components/sections/GreetingBanner";
import { MainFeaturesShowcase } from "../components/sections/MainFeaturesShowcase";
import { DownloadBanner } from "../components/sections/DownloadBanner";
import { fetchCmsSection } from "../lib/cms";

export async function loader() {
  const seo = await fetchCmsSection("seo");
  const defaults = seo?.[0]?.content as { default_title?: string; default_description?: string } | null;
  return {
    seoTitle:
      defaults?.default_title ??
      "MurihSpace | Secure Platform for Creators & Businesses",
    seoDescription:
      defaults?.default_description ??
      "Empowering creators and businesses with secure communities, digital and physical storefronts, live audio stages, and encrypted communication.",
  };
}

export function meta({
  loaderData,
}: {
  loaderData: { seoTitle: string; seoDescription: string };
}) {
  return [
    {
      title:
        loaderData?.seoTitle ??
        "MurihSpace | Secure Platform for Creators & Businesses",
    },
    {
      name: "description",
      content:
        loaderData?.seoDescription ??
        "Empowering creators and businesses with secure communities, digital and physical storefronts, live audio stages, and encrypted communication.",
    },
  ];
}

export default function Home() {
  return (
    <>
      <HeroSection />
      <GreetingBanner />
      <MainFeaturesShowcase />
      <DownloadBanner />
    </>
  );
}
