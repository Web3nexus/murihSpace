import { useState } from "react";
import type { Route } from "./+types/help-article";
import { Link } from "react-router";
import {
  ChevronLeft,
  Check,
  ThumbsUp,
  ThumbsDown,
  Search,
  CheckCircle,
  LifeBuoy,
} from "lucide-react";
import { Breadcrumbs } from "../components/help/Breadcrumbs";
import { categoryIcon } from "../components/help/categoryIcon";
import { ArticleCard } from "../components/help/ArticleCard";
import { ContactSupport } from "../components/help/ContactSupport";
import { getArticle, sendFeedback, type HelpArticle, HelpApiError } from "../lib/help";

export async function loader({ params }: Route.LoaderArgs) {
  const slug = params.slug;
  try {
    const article = await getArticle(slug);
    return { article, slug };
  } catch (error) {
    if (error instanceof HelpApiError && error.status === 404) {
      throw new Response("Not Found", { status: 404 });
    }
    throw error;
  }
}

export function meta({ loaderData }: Route.MetaArgs) {
  const article: HelpArticle | undefined = loaderData?.article;
  return [
    { title: article?.seo_title || `${article?.title ?? "Help article"} — MurihSpace` },
    { name: "description", content: article?.seo_description || article?.excerpt || "MurihSpace help article." },
    {
      tagName: "link",
      rel: "canonical",
      href: article?.slug ? `/help/article/${encodeURIComponent(article.slug)}` : "/help",
    },
  ];
}

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-NZ", { year: "numeric", month: "long", day: "numeric" });
}

export default function HelpArticle({ loaderData }: Route.ComponentProps) {
  const { article, slug } = loaderData;

  const [feedback, setFeedback] = useState<"idle" | "yes" | "no">("idle");
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [tocOpen, setTocOpen] = useState(false);

  const updated = formatDate(article.updated_at ?? article.published_at);
  const Icon = categoryIcon(article.category);

  async function give(helpful: boolean) {
    setFeedback(helpful ? "yes" : "no");
    setSubmitting(true);
    try {
      await sendFeedback(slug, helpful, comment.trim() || undefined);
      setDone(true);
    } catch {
      setDone(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="bg-white text-[#102840]">
      <div className="mx-auto max-w-7xl px-6 pt-10 pb-20">
        <Breadcrumbs
          items={[
            {
              label: article.category_name ?? "Help",
              to: article.category ? `/help/category/${encodeURIComponent(article.category)}` : undefined,
            },
            { label: article.title },
          ]}
        />

        <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_260px]">
          {/* ── Article body ── */}
          <article>
            <div className="flex items-center gap-3">
              <div className="inline-flex size-11 items-center justify-center rounded-2xl bg-[#2164b6]/10 text-[#2164b6]">
                <Icon className="size-5" />
              </div>
              <div>
                <p className="text-[12px] font-bold uppercase tracking-wide text-[#2164b6]">
                  {article.category_name ?? "Help Center"}
                </p>
                {updated && (
                  <p className="mt-0.5 flex items-center gap-1.5 text-[12px] text-[#98A2B3]">
                    <Check className="size-3.5" /> Updated {updated}
                  </p>
                )}
              </div>
            </div>

            <h1 className="mt-5 text-3xl font-black tracking-tight text-[#102840] sm:text-4xl">
              {article.title}
            </h1>
            {article.excerpt && (
              <p className="mt-3 text-[16px] leading-relaxed text-[#667085]">{article.excerpt}</p>
            )}

            {/* Inline TOC */}
            {article.sections.length > 0 && (
              <div className="mt-8">
                <button
                  onClick={() => setTocOpen((v) => !v)}
                  className="flex w-full items-center justify-between rounded-xl border border-[#D6E0E8] bg-[#F7FAFC] px-4 py-3 text-[13px] font-bold text-[#102840] transition-colors hover:border-[#2164b6]/40"
                >
                  <span>
                    In this article<span className="ml-1 font-normal text-[#98A2B3]">({article.sections.length} sections)</span>
                  </span>
                  <span className={`text-[#98A2B3] transition-transform ${tocOpen ? "rotate-180" : ""}`}>▾</span>
                </button>
                {tocOpen && (
                  <ul className="mt-2 space-y-0.5 rounded-xl border border-[#D6E0E8] p-2">
                    {article.sections.map((s, i) => (
                      <li key={i}>
                        <a
                          href={`#section-${i}`}
                          onClick={() => setTocOpen(false)}
                          className="block px-3 py-2 rounded-lg text-[13px] font-medium text-[#667085] transition-colors hover:bg-[#F0F5F8] hover:text-[#2164b6]"
                        >
                          {s.heading}
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div className="mt-8 space-y-7">
              {article.sections.map((s, i) => (
                <section key={i} id={`section-${i}`} className="scroll-mt-28">
                  <h2 className="flex items-center gap-2 text-[20px] font-bold tracking-tight text-[#102840]">
                    <span className="h-2 w-1 rounded-full bg-[#2164b6]" />
                    {s.heading}
                  </h2>
                  <p className="mt-3 text-[15px] leading-relaxed text-[#4A5A6E]">{s.body}</p>
                </section>
              ))}
            </div>

            {/* ── Was this helpful? ── */}
            <div className="mt-12 rounded-2xl border border-[#D6E0E8] bg-[#F7FAFC] p-6">
              {done ? (
                <div className="flex items-center gap-3">
                  <CheckCircle className="size-6 shrink-0 text-[#16A34A]" />
                  <div>
                    <p className="font-bold text-[#102840]">Thanks for your feedback!</p>
                    <p className="text-[13px] text-[#667085]">It helps us improve our help articles.</p>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-center text-[15px] font-bold text-[#102840]">Was this article helpful?</p>
                  <div className="mt-4 flex justify-center gap-3">
                    <button
                      onClick={() => give(true)}
                      disabled={submitting}
                      className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition-colors disabled:opacity-50 ${
                        feedback === "yes"
                          ? "bg-[#16A34A] text-white"
                          : "border border-[#D6E0E8] bg-white text-[#102840] hover:border-[#2164b6]/50"
                      }`}
                    >
                      <ThumbsUp className="size-4" /> Yes, it helped
                    </button>
                    <button
                      onClick={() => setFeedback("no")}
                      disabled={submitting}
                      className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition-colors disabled:opacity-50 ${
                        feedback === "no"
                          ? "bg-[#667085] text-white"
                          : "border border-[#D6E0E8] bg-white text-[#102840] hover:border-[#2164b6]/50"
                      }`}
                    >
                      <ThumbsDown className="size-4" /> Not quite
                    </button>
                  </div>
                  {feedback === "no" && (
                    <div className="mx-auto mt-4 max-w-md">
                      <label htmlFor="feedback-comment" className="sr-only">
                        Tell us what was wrong
                      </label>
                      <textarea
                        id="feedback-comment"
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        rows={3}
                        placeholder="Tell us what to improve (optional)"
                        className="w-full rounded-xl border border-[#D6E0E8] bg-white p-3 text-sm text-[#102840] placeholder:text-[#98A2B3] outline-none focus:border-[#2164b6]"
                      />
                      <button
                        onClick={() => give(false)}
                        disabled={submitting}
                        className="mt-2 inline-flex items-center gap-1.5 text-sm font-bold text-[#2164b6] hover:underline disabled:opacity-50"
                      >
                        {submitting ? "Sending…" : "Submit feedback"}
                      </button>
                    </div>
                  )}
                </>
              )}

              {(done || feedback === "no") && !contactOpen && (
                <div className="mt-5 border-t border-[#E5EDF3] pt-4 text-center">
                  <button
                    onClick={() => setContactOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#D6E0E8] bg-white px-4 py-2 text-sm font-bold text-[#2164b6] transition-colors hover:border-[#2164b6]/50"
                  >
                    <LifeBuoy className="size-4" />
                    Couldn't find what you need? Contact support
                  </button>
                </div>
              )}

              {contactOpen && (
                <div className="mt-5">
                  <ContactSupport
                    context={{
                      attempted_article: article.title,
                      current_page: `/help/article/${slug}`,
                    }}
                    onClose={() => setContactOpen(false)}
                  />
                </div>
              )}
            </div>
          </article>

          {/* ── Sidebar ── */}
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-2xl border border-[#D6E0E8] bg-white p-5">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#98A2B3]">Related</p>
              <div className="mt-3 space-y-1">
                {article.related && article.related.length > 0 ? (
                  article.related.map((r) => (
                    <Link
                      key={r.slug}
                      to={`/help/article/${encodeURIComponent(r.slug)}`}
                      className="block rounded-lg px-2 py-2 text-[13px] font-semibold text-[#667085] transition-colors hover:bg-[#F0F5F8] hover:text-[#2164b6]"
                    >
                      {r.title}
                    </Link>
                  ))
                ) : (
                  <p className="px-2 py-2 text-[13px] text-[#98A2B3]">No related articles.</p>
                )}
              </div>
            </div>

            <div className="mt-6 rounded-2xl bg-[#102840] p-6">
              <p className="text-[11px] font-bold uppercase tracking-wide text-[#98A2B3]">Still stuck?</p>
              <p className="mt-1.5 text-[13px] text-[#B7C6D1]">
                Our team is happy to help you directly.
              </p>
              <a
                href="mailto:support@murihspace.com?subject=Help request"
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-[#38A8D8] px-3.5 py-2 text-[13px] font-bold text-white transition-colors hover:bg-[#2f8fc0]"
              >
                Contact support
              </a>
            </div>

            <Link
              to="/help"
              className="mt-6 inline-flex items-center gap-1.5 text-[13px] font-bold text-[#2164b6] hover:underline"
            >
              <ChevronLeft className="size-4" /> Back to Help Center
            </Link>
          </aside>
        </div>

        {/* ── Related articles grid ── */}
        {article.related && article.related.length > 0 && (
          <div className="mt-16 border-t border-[#E5EDF3] pt-10">
            <h2 className="text-xl font-bold tracking-tight text-[#102840]">
              <Search className="mr-2 inline size-5 text-[#2164b6]" />
              Related articles
            </h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {article.related.map((r) => (
                <ArticleCard key={r.slug} article={r} />
              ))}
            </div>
          </div>
        )}

        <div className="mt-14 rounded-2xl border border-[#D6E0E8] bg-[#F7FAFC] p-6 text-center">
          <p className="text-[15px] font-semibold text-[#667085]">
            Can’t find the answer you need? Search more topics →
          </p>
          <Link to="/help" className="mt-2 inline-block font-bold text-[#2164b6] hover:underline">
            Browse the Help Center
          </Link>
        </div>
      </div>
    </div>
  );
}