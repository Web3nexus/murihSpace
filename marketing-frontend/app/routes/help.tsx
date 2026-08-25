import type { Route } from "./+types/help";
import { BookOpen, LifeBuoy, Mail, MessageSquare } from "lucide-react";
import { Link } from "react-router";
import { HelpSearch } from "../components/help/HelpSearch";
import { Breadcrumbs } from "../components/help/Breadcrumbs";
import { categoryIcon } from "../components/help/categoryIcon";
import { getCategories, getArticles, type HelpCategory, type HelpArticleListItem } from "../lib/help";

export async function loader() {
  const [categories, articles] = await Promise.all([getCategories(), getArticles()]);
  return { categories, articles };
}

export function meta() {
  return [
    { title: "Help Center — MurihSpace" },
    {
      name: "description",
      content:
        "Find answers about accounts, creators, gifting, MurihPay, communities and more in the MurihSpace Help Center.",
    },
    { tagName: "link", rel: "canonical", href: "/help" },
  ];
}

const POPULAR_SLUGS = [
  "create-account",
  "verify-email",
  "log-in",
  "wallet-types",
  "payouts",
  "create-community",
  "storefront",
  "send-gift",
];

function popularArticles(articles: HelpArticleListItem[]): HelpArticleListItem[] {
  const map = new Map(articles.map((a) => [a.slug, a]));
  return POPULAR_SLUGS.map((s) => map.get(s)).filter((a): a is HelpArticleListItem => Boolean(a));
}

export default function HelpIndex({ loaderData }: Route.ComponentProps) {
  const { categories, articles } = loaderData;
  const popular = popularArticles(articles);

  return (
    <div className="bg-white text-[#102840]">
      {/* ── Hero: Search ── */}
      <section className="relative overflow-hidden border-b border-[#D6E0E8] bg-gradient-to-b from-[#F7FAFC] to-white">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 15% 20%, #2164b6 0px, transparent 0.8px)",
            backgroundSize: "26px 26px",
          }}
        />
        <div className="relative mx-auto max-w-7xl px-6 pt-16 pb-10">
          <Breadcrumbs items={[]} />
          <div className="mt-6 flex flex-col items-center text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#D6E0E8] bg-white px-3.5 py-1.5 text-[12px] font-bold text-[#2164b6]">
              <BookOpen className="size-3.5" />
              How can we help you today?
            </div>
            <h1 className="mt-4 max-w-3xl text-4xl font-black tracking-tight text-[#102840] sm:text-5xl">
              MurihSpace Help Center
            </h1>
            <p className="mt-3 max-w-xl text-center text-lg text-[#667085]">
              Find answers about accounts, creators, gifting, MurihPay, communities and more.
            </p>
            <div className="mt-6 w-full max-w-2xl">
              <HelpSearch />
            </div>
          </div>
        </div>
      </section>

      {/* ── Popular topics ── */}
      <section className="mx-auto max-w-7xl px-6 py-16">
        <h2 className="text-2xl font-bold tracking-tight text-[#102840]">Popular topics</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {popular.map((a) => (
            <Link
              key={a.slug}
              to={`/help/article/${encodeURIComponent(a.slug)}`}
              className="group rounded-2xl border border-[#D6E0E8] bg-white p-5 transition-all hover:-translate-y-0.5 hover:border-[#2164b6]/50 hover:shadow-[0_8px_20px_rgba(16,40,64,0.08)]"
            >
              <div className="inline-flex size-9 items-center justify-center rounded-xl bg-[#2164b6]/10 text-[#2164b6] transition-transform group-hover:scale-105">
                {(() => {
                  const Icon = categoryIcon(a.category);
                  return <Icon className="size-4.5" />;
                })()}
              </div>
              <p className="mt-3 text-[15px] font-bold text-[#102840] group-hover:text-[#2164b6]">
                {a.title}
              </p>
              {a.excerpt && (
                <p className="mt-1 line-clamp-2 text-[13px] text-[#667085]">{a.excerpt}</p>
              )}
            </Link>
          ))}
        </div>
      </section>

      {/* ── Browse categories ── */}
      <section className="border-t border-[#E5EDF3] bg-[#F7FAFC] py-16">
        <div className="mx-auto max-w-7xl px-6">
          <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-[#102840]">Browse by topic</h2>
              <p className="mt-1 text-[15px] text-[#667085]">
                Explore step-by-step guides organised by area of MurihSpace.
              </p>
            </div>
            <span className="text-[12px] font-bold uppercase tracking-wide text-[#98A2B3]">
              {articles.length} articles
            </span>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((cat: HelpCategory) => {
              const Icon = categoryIcon(cat.slug);
              return (
                <Link
                  key={cat.slug}
                  to={`/help/category/${encodeURIComponent(cat.slug)}`}
                  className="group rounded-2xl border border-[#D6E0E8] bg-white p-6 transition-all hover:-translate-y-0.5 hover:border-[#2164b6]/50 hover:shadow-[0_8px_20px_rgba(16,40,64,0.08)]"
                >
                  <div className="flex items-center justify-between">
                    <div className="inline-flex size-11 items-center justify-center rounded-2xl bg-[#2164b6]/10 text-[#2164b6] transition-transform group-hover:scale-105">
                      <Icon className="size-5" />
                    </div>
                    {cat.article_count != null && (
                      <span className="rounded-full bg-[#F0F5F8] px-2.5 py-1 text-[11px] font-bold text-[#667085]">
                        {cat.article_count} articles
                      </span>
                    )}
                  </div>
                  <p className="mt-4 text-[16px] font-bold text-[#102840] group-hover:text-[#2164b6]">
                    {cat.label ?? cat.name}
                  </p>
                  {cat.blurb && (
                    <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-[#667085]">
                      {cat.blurb}
                    </p>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Contact support ── */}
      <section className="mx-auto max-w-7xl px-6 py-16">
        <div className="overflow-hidden rounded-3xl bg-[#102840]">
          <div className="grid gap-8 p-8 sm:p-12 lg:grid-cols-2 lg:items-center">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-white">
                Still need a hand?
              </h2>
              <p className="mt-2 text-[15px] text-[#B7C6D1]">
                Our support team is available to help with anything the articles don’t cover.
              </p>
              <div className="mt-6 flex max-w-md space-y-2">
                <div className="flex items-center gap-3 rounded-2xl bg-white/5 px-4 py-3 backdrop-blur-sm">
                  <Mail className="size-4.5 shrink-0 text-[#38A8D8]" />
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wide text-[#98A2B3]">
                      Email us
                    </p>
                    <p className="text-[14px] font-semibold text-white">support@murihspace.com</p>
                  </div>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-3 rounded-2xl bg-white/5 px-4 py-3 backdrop-blur-sm">
                <MessageSquare className="size-4.5 shrink-0 text-[#38A8D8]" />
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-[#98A2B3]">
                    Live chat
                  </p>
                  <p className="text-[14px] font-semibold text-white">Monday–Friday, 9am–5pm NZT</p>
                </div>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                ["Log in to MurihSpace", "/login", "Resolve account issues from your dashboard."],
                ["Start for free", "/register", "Create a new account in minutes."],
              ].map(([label, to, desc]) => (
                <Link
                  key={to}
                  to={to}
                  className="group rounded-2xl border border-white/10 bg-white/5 p-5 text-left backdrop-blur-sm transition-colors hover:bg-white/10"
                >
                  <LifeBuoy className="size-5 text-[#38A8D8]" />
                  <p className="mt-3 text-[15px] font-bold text-white group-hover:text-[#38A8D8]">
                    {label}
                  </p>
                  <p className="mt-1 text-[12px] text-[#B7C6D1]">{desc}</p>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}