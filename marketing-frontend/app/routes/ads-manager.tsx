import { useState } from "react";
import { Link } from "react-router";
import {
  ArrowRight,
  BarChart3,
  ChevronDown,
  Megaphone,
  ShieldCheck,
  ShoppingBag,
  Target,
  Users,
  Wallet,
  CalendarCheck,
  Image as ImageIcon,
} from "lucide-react";
import { getAdsLoginUrl } from "~/lib/env";

const SITE_URL = (import.meta.env.VITE_SITE_URL as string | undefined)?.replace(/\/+$/, "") ?? "";
const PAGE_PATH = "/ads-manager";
const PAGE_TITLE = "MurihSpace Ads Manager | Run Ads to Your Audience, Storefront & Events";
const PAGE_DESCRIPTION =
  "Create campaigns, define audiences, manage budgets and track results with MurihSpace Ads Manager. Promote your posts, storefront products and events to the people most likely to engage.";

const FAQS = [
  {
    question: "What is MurihSpace Ads Manager?",
    answer:
      "Ads Manager is the advertising tool inside MurihSpace. It lets creators and vendors plan campaigns, choose who sees them, set a budget, and read the results, all from the same account they use for posts, communities, storefronts and wallet.",
  },
  {
    question: "Who can use Ads Manager?",
    answer:
      "Ads Manager is open to MurihSpace accounts. Sign in with your existing account on the web; there is no separate ads account to set up.",
  },
  {
    question: "Can I promote products from my storefront?",
    answer:
      "Yes. Add products to a catalog, then build product ads from it so each ad links to the item it promotes and stays in sync with your stock and prices.",
  },
  {
    question: "How does budget work?",
    answer:
      "You choose a budget for each campaign and ad group, and you can review spend as the campaign runs. Billing history is available in the Billing section.",
  },
  {
    question: "How do I know if my ads work?",
    answer:
      "The Analytics section shows how your ads perform over time. Events Manager lets you connect the actions people take after seeing an ad, such as visiting a product or booking an event.",
  },
];

const STEPS = [
  {
    icon: Target,
    title: "Choose an objective",
    text: "Pick what you want the ad to do: reach more people, drive visits, promote a product or fill an event.",
  },
  {
    icon: Users,
    title: "Define your audience",
    text: "Target by interests and location, or save an audience and reuse it across campaigns.",
  },
  {
    icon: Wallet,
    title: "Set your budget and publish",
    text: "Set a budget, add your creative, review the ad and publish. Follow results from the dashboard.",
  },
];

const FEATURES = [
  {
    icon: Megaphone,
    title: "Campaigns and ad groups",
    text: "Organise ads by goal. Each campaign holds ad groups with their own audience, schedule and budget.",
  },
  {
    icon: Users,
    title: "Audiences",
    text: "Build audiences from location, interests and past engagement, then reuse them across campaigns.",
  },
  {
    icon: ImageIcon,
    title: "Creative library",
    text: "Upload images and video once and use them in any ad. Keep every version of a creative in one place.",
  },
  {
    icon: ShoppingBag,
    title: "Product catalogs",
    text: "Connect your storefront products so product ads always show current items, prices and availability.",
  },
  {
    icon: CalendarCheck,
    title: "Events Manager",
    text: "Promote events and track the actions people take after they see your ad.",
  },
  {
    icon: BarChart3,
    title: "Analytics and billing",
    text: "Read performance over time and keep a clear record of spend in one billing history.",
  },
];

const RELATED = [
  { to: "/creators", title: "For Creators", text: "Grow your audience and turn it into income." },
  { to: "/business", title: "For Business", text: "Storefronts, orders and escrow for vendors." },
  { to: "/features", title: "All Features", text: "Everything MurihSpace offers in one place." },
  { to: "/help", title: "Help Center", text: "Guides for campaigns, billing and catalogs." },
];

const SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "get-started", label: "Get started" },
  { id: "features", label: "Features" },
  { id: "faq", label: "FAQ" },
];

export function meta() {
  return [
    { title: PAGE_TITLE },
    { name: "description", content: PAGE_DESCRIPTION },
    { name: "keywords", content: "ads manager, social ads, creator advertising, promote products, MurihSpace ads, campaign manager, event promotion" },
    { property: "og:title", content: PAGE_TITLE },
    { property: "og:description", content: PAGE_DESCRIPTION },
    { property: "og:type", content: "website" },
    { property: "og:url", content: `${SITE_URL}${PAGE_PATH}` },
    { name: "twitter:card", content: "summary_large_image" },
    { tagName: "link", rel: "canonical", href: `${SITE_URL}${PAGE_PATH}` },
  ];
}

export default function AdsManagerPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  // Every Ads Manager action goes to the ads app's sign-in page, not to a marketing page.
  const adsUrl = getAdsLoginUrl();

  // Structured data so search engines can read the page as a software product with FAQs.
  const structuredData = [
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "MurihSpace Ads Manager",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      description: PAGE_DESCRIPTION,
      url: `${SITE_URL}${PAGE_PATH}`,
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: FAQS.map((faq) => ({
        "@type": "Question",
        name: faq.question,
        acceptedAnswer: { "@type": "Answer", text: faq.answer },
      })),
    },
  ];

  return (
    <div className="bg-[#FAF9F5] text-[#102840]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />

      {/* ================= HERO ================= */}
      <section className="hero-section">
        <div className="container-landing">
          <div className="hero-grid">
            <div className="hero-content">
              <span className="feature-tag">MurihSpace Ads Manager</span>
              <h1 className="title-hero">Reach the right people with MurihSpace Ads Manager</h1>
              <p className="subtitle-hero">
                Plan campaigns, choose your audience, set a budget and read the results. Promote your posts, your
                storefront products and your events from the account you already use.
              </p>
              <div className="hero-actions">
                <a href={adsUrl} className="btn-wa-primary">
                  Open Ads Manager
                </a>
                <a href="#get-started" className="btn-wa-outline">
                  See how it works
                </a>
              </div>
            </div>

            {/* Hero visual: campaign flow, no figures */}
            <div className="hero-visual-wrapper" aria-hidden="true">
              <div className="feature-card-frame bg-white p-6 rounded-3xl border border-[#D6E0E8] shadow-xl">
                <div className="flex items-center justify-between pb-4 border-b border-[#D6E0E8]">
                  <div className="flex items-center gap-2">
                    <Megaphone className="size-5 text-[#2164B6]" />
                    <span className="text-sm font-bold text-[#102840]">Spring product launch</span>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-[#E8F8FF] text-[#2164B6] text-xs font-bold border border-[#BFE3F5]">
                    Ready to publish
                  </span>
                </div>
                <ol className="my-5 flex flex-col gap-3 list-none p-0">
                  {["Objective: Promote a product", "Audience: Saved audience", "Budget: Set for this campaign", "Creative: From your library"].map(
                    (item) => (
                      <li
                        key={item}
                        className="p-3.5 rounded-2xl bg-[#FAF9F5] border border-[#D6E0E8] text-xs font-semibold text-[#102840] flex items-center justify-between"
                      >
                        {item}
                        <ArrowRight className="size-3.5 text-[#2164B6]" />
                      </li>
                    ),
                  )}
                </ol>
                <div className="p-3 rounded-xl bg-[#E8F8FF] border border-[#D6E0E8] flex items-center gap-2 text-xs text-[#2164B6] font-semibold">
                  <ShieldCheck className="size-4" /> Signed in with your MurihSpace account
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= TAB ROW ================= */}
      <nav className="sticky top-20 z-40 bg-white/95 backdrop-blur border-b border-[#D6E0E8]" aria-label="On this page">
        <div className="container-landing flex gap-2 overflow-x-auto py-3">
          {SECTIONS.map((section) => (
            <a
              key={section.id}
              href={`#${section.id}`}
              className="shrink-0 px-4 py-1.5 rounded-full text-sm font-semibold text-[#5A7184] hover:text-[#2164B6] hover:bg-[#E8F8FF] transition-colors"
            >
              {section.label}
            </a>
          ))}
        </div>
      </nav>

      {/* ================= OVERVIEW ================= */}
      <section id="overview" className="feature-section bg-white scroll-mt-40">
        <div className="container-landing">
          <div className="feature-grid">
            <div className="feature-info">
              <span className="feature-tag">Overview</span>
              <h2 className="title-section">Advertising that starts from your MurihSpace account</h2>
              <p className="subtitle-hero">
                Ads Manager sits beside your posts, communities, storefront and wallet. Promote what you have already
                built, measure what happens next, and keep one clear record of spend.
              </p>
              <p className="mt-4 text-[#5A7184]">
                Whether you are growing a creator audience or selling products, the same tools cover campaigns,
                audiences, creative and reporting.
              </p>
              <div className="mt-6">
                <a href={adsUrl} className="btn-wa-primary">
                  Open Ads Manager <ArrowRight className="size-4 ml-1 inline" />
                </a>
              </div>
            </div>
            <div className="feature-visual">
              <div className="feature-card-frame bg-[#FAF9F5] p-6 rounded-3xl border border-[#D6E0E8]">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#102840] mb-4">Promote</h3>
                <ul className="flex flex-col gap-3 text-sm list-none p-0">
                  <li className="flex items-start gap-2.5">
                    <Megaphone className="size-4 text-[#2164B6] shrink-0 mt-0.5" />
                    <span>Community posts and creator profiles</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <ShoppingBag className="size-4 text-[#2164B6] shrink-0 mt-0.5" />
                    <span>Storefront products from your catalog</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CalendarCheck className="size-4 text-[#2164B6] shrink-0 mt-0.5" />
                    <span>Events and live rooms</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= GET STARTED ================= */}
      <section id="get-started" className="feature-section bg-[#F0F4F8] scroll-mt-40">
        <div className="container-landing">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="feature-tag justify-center">Get started</span>
            <h2 className="title-section">Three steps from idea to published ad</h2>
            <p className="subtitle-hero mt-3">
              Ads Manager walks you through each part of a campaign in the order it matters.
            </p>
          </div>
          <div className="download-platforms-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
            {STEPS.map(({ icon: Icon, title, text }, index) => (
              <div key={title} className="platform-card items-start text-left">
                <span className="size-9 rounded-full bg-[#E8F8FF] text-[#2164B6] flex items-center justify-center font-bold">
                  {index + 1}
                </span>
                <h3 className="platform-title mt-3 flex items-center gap-2">
                  <Icon className="size-4 text-[#2164B6]" /> {title}
                </h3>
                <p className="platform-desc">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= FEATURES ================= */}
      <section id="features" className="feature-section bg-white scroll-mt-40">
        <div className="container-landing">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="feature-tag justify-center">Features</span>
            <h2 className="title-section">Everything in one ads workspace</h2>
            <p className="subtitle-hero mt-3">
              Each part of Ads Manager connects to the next, so your audience, creative and budget stay in step.
            </p>
          </div>
          <div className="download-platforms-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <article key={title} className="platform-card items-start text-left">
                <span className="size-10 rounded-xl bg-[#E8F8FF] text-[#2164B6] flex items-center justify-center">
                  <Icon className="size-5" />
                </span>
                <h3 className="platform-title mt-4">{title}</h3>
                <p className="platform-desc">{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ================= TRUST ================= */}
      <section className="feature-section bg-[#F0F4F8]">
        <div className="container-landing">
          <div className="feature-grid">
            <div className="feature-info">
              <span className="feature-tag">Security &amp; control</span>
              <h2 className="title-section">Your account, your rules</h2>
              <p className="subtitle-hero">
                Ads Manager uses your MurihSpace sign-in, so there is no second password to manage. You decide what each
                campaign promotes, who it reaches and how much it spends.
              </p>
              <div className="mt-6 flex flex-col gap-3 text-sm text-[#5A7184]">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="size-4 text-[#2164B6]" />
                  <span>Single sign-on with your MurihSpace account</span>
                </div>
                <div className="flex items-center gap-2">
                  <Wallet className="size-4 text-[#2164B6]" />
                  <span>Budgets you set per campaign, with billing history</span>
                </div>
                <div className="flex items-center gap-2">
                  <BarChart3 className="size-4 text-[#2164B6]" />
                  <span>Performance reporting you can review at any time</span>
                </div>
              </div>
            </div>
            <div className="feature-visual">
              <div className="feature-card-frame bg-white p-6 rounded-3xl border border-[#D6E0E8] shadow-lg">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#102840] mb-4">Campaign lifecycle</h3>
                <div className="flex flex-col gap-4 text-xs">
                  {[
                    ["Draft", "Set the objective, audience and creative."],
                    ["Live", "The ad runs within the budget you set."],
                    ["Review", "Check results in Analytics and adjust."],
                  ].map(([title, text], index) => (
                    <div key={title} className="flex items-start gap-3">
                      <div className="size-7 rounded-full bg-[#E8F8FF] text-[#2164B6] flex items-center justify-center font-bold shrink-0">
                        {index + 1}
                      </div>
                      <div>
                        <span className="font-bold text-[#102840] block">{title}</span>
                        <p className="text-[#5A7184] mt-0.5">{text}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= FAQ ================= */}
      <section id="faq" className="feature-section bg-white scroll-mt-40">
        <div className="container-landing max-w-3xl">
          <div className="text-center mb-10">
            <span className="feature-tag justify-center">FAQ</span>
            <h2 className="title-section">Common questions about Ads Manager</h2>
          </div>
          <div className="flex flex-col divide-y divide-[#D6E0E8] border-y border-[#D6E0E8]">
            {FAQS.map((faq, index) => {
              const isOpen = openFaq === index;
              return (
                <div key={faq.question}>
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : index)}
                    aria-expanded={isOpen}
                    className="w-full flex items-center justify-between gap-4 py-5 text-left font-semibold text-[#102840] hover:text-[#2164B6] transition-colors cursor-pointer"
                  >
                    {faq.question}
                    <ChevronDown className={`size-5 shrink-0 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
                  </button>
                  {isOpen && <p className="pb-5 text-[#5A7184] leading-relaxed">{faq.answer}</p>}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ================= RELATED ================= */}
      <section className="feature-section bg-[#F0F4F8]">
        <div className="container-landing">
          <h2 className="title-section text-center mb-10">Explore more on MurihSpace</h2>
          <div className="download-platforms-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
            {RELATED.map((item) => (
              <Link key={item.to} to={item.to} className="platform-card items-start text-left no-underline">
                <h3 className="platform-title">{item.title}</h3>
                <p className="platform-desc">{item.text}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ================= CTA ================= */}
      <section className="cta-banner">
        <div className="container-landing">
          <div className="cta-content">
            <h2 className="cta-title">Ready to run your first campaign?</h2>
            <p className="cta-subtitle">Sign in with your MurihSpace account and open Ads Manager.</p>
            <div className="cta-buttons">
              <a href={adsUrl} className="btn-wa-primary">
                <span>Open Ads Manager</span>
                <ArrowRight className="size-4 ml-1 inline" />
              </a>
              <a href="#features" className="btn-wa-outline" style={{ color: "#FFFFFF", borderColor: "#FFFFFF" }}>
                See the features
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
