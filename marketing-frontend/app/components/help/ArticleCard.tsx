import { Link } from "react-router";
import { ArrowRight } from "lucide-react";
import type { HelpArticleListItem } from "~/lib/help";

export function ArticleCard({ article }: { article: HelpArticleListItem }) {
  return (
    <Link
      to={`/help/article/${encodeURIComponent(article.slug)}`}
      className="group rounded-2xl border border-[#D6E0E8] bg-white p-5 transition-all hover:-translate-y-0.5 hover:border-[#2164b6]/50 hover:shadow-[0px_8px_20px_rgba(16,40,64,0.08)]"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-bold uppercase tracking-wide text-[#2164b6]">
          {article.category_name ?? "Help"}
        </p>
        <ArrowRight className="size-4 text-[#B7C6D1] transition-colors group-hover:text-[#2164b6]" />
      </div>
      <p className="mt-1.5 text-[15px] font-bold text-[#102840] group-hover:text-[#2164b6]">
        {article.title}
      </p>
      {article.excerpt && (
        <p className="mt-1 line-clamp-2 text-[13px] text-[#667085]">{article.excerpt}</p>
      )}
    </Link>
  );
}