import { Link } from "react-router";
import { ChevronRight, Home, BookOpen } from "lucide-react";

interface Crumb {
  label: string;
  to?: string;
}

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-1.5 text-[13px] font-medium text-[#98A2B3]">
        <li>
          <Link to="/" className="inline-flex items-center gap-1 transition-colors hover:text-[#2164b6]">
            <Home className="size-3.5" />
            MurihSpace
          </Link>
        </li>
        <li className="inline-flex items-center gap-1.5">
          <ChevronRight className="size-3.5" aria-hidden="true" />
          <Link to="/help" className="inline-flex items-center gap-1 transition-colors hover:text-[#2164b6]">
            <BookOpen className="size-3.5" />
            Help Center
          </Link>
        </li>
        {items.map((c, i) => {
          const last = i === items.length - 1;
          return (
            <li key={i} className="inline-flex items-center gap-1.5" aria-current={last ? "page" : undefined}>
              <ChevronRight className="size-3.5" aria-hidden="true" />
              {c.to && !last ? (
                <Link to={c.to} className="transition-colors hover:text-[#2164b6]">
                  {c.label}
                </Link>
              ) : (
                <span className="truncate text-[#102840]">{c.label}</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}