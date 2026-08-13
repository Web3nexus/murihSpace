import type { Route } from "./+types/help-category";
import { Link } from "react-router";
import { ChevronLeft } from "lucide-react";
import { Breadcrumbs } from "../components/help/Breadcrumbs";
import { categoryIcon } from "../components/help/categoryIcon";
import { ArticleCard } from "../components/help/ArticleCard";
import { getCategories, getArticles, type HelpCategory, type HelpArticleListItem } from "../lib/help";

export async function loader({ params }: Route.LoaderArgs) {
  const slug = params.slug;
  const [categories, articles] = await Promise.all([getCategories(), getArticles({ category: slug })]);
  const category = categories.find((c) => c.slug === slug) ?? null;
  return { category, articles, slug };
}

export function meta({ loaderData }: Route.MetaArgs) {
  const title = loaderData?.category?.label ?? loaderData?.slug ?? "Help";
  return [
    { title: `${title} — Help Center | MurihSpace` },
    { name: "description", content: loaderData?.category?.blurb ?? `Help articles about ${title} on MurihSpace.` },
    {
      tagName: "link",
      rel: "canonical",
      href: loaderData?.slug ? `/help/category/${encodeURIComponent(loaderData.slug)}` : "/help",
    },
  ];
}

export default function HelpCategory({ loaderData }: Route.ComponentProps) {
  const { category, articles, slug } = loaderData;

  if (!category) {
    return (
      <div className="bg-white px-6 py-24 text-center text-[#102840]">
        <p className="text-2xl font-bold">Topic not found</p>
        <p className="mt-2 text-[#667085]">We couldn’t find that help topic.</p>
        <Link to="/help" className="mt-6 inline-flex items-center gap-1.5 font-semibold text-[#2164b6] hover:underline">
          <ChevronLeft className="size-4" /> Back to Help Center
        </Link>
      </div>
    );
  }

  const Icon = categoryIcon(category.slug);

  return (
    <div className="bg-white text-[#102840]">
      <div className="mx-auto max-w-7xl px-6 pt-10 pb-20">
        <Breadcrumbs items={[{ label: category.label ?? category.name, to: `/help/category/${encodeURIComponent(slug)}` }]} />

        <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="inline-flex size-14 shrink-0 items-center justify-center rounded-2xl bg-[#2164b6]/10 text-[#2164b6]">
            <Icon className="size-6" />
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tight text-[#102840]">
              {category.label ?? category.name}
            </h1>
            {category.blurb && <p className="mt-1 max-w-2xl text-[15px] text-[#667085]">{category.blurb}</p>}
          </div>
        </div>

        {articles.length > 0 ? (
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {articles.map((a: HelpArticleListItem) => (
              <ArticleCard key={a.slug} article={a} />
            ))}
          </div>
        ) : (
          <div className="mt-10 rounded-2xl border border-[#D6E0E8] bg-[#F7FAFC] p-10 text-center">
            <p className="font-semibold text-[#102840]">No articles yet for this topic.</p>
            <p className="mt-1 text-sm text-[#667085]">Check back soon — or contact support for help.</p>
          </div>
        )}

        <div className="mt-14 rounded-2xl border border-[#D6E0E8] bg-[#F7FAFC] p-6 text-center">
          <p className="text-[15px] font-semibold text-[#667085]">
            Can’t find what you’re looking for?
          </p>
          <a
            href="mailto:support@murihspace.com"
            className="mt-2 inline-block font-bold text-[#2164b6] hover:underline"
          >
            Contact support →
          </a>
        </div>
      </div>
    </div>
  );
}