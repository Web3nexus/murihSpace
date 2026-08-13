import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { Search, X, ArrowUpRight, LifeBuoy } from "lucide-react";
import { searchHelp, type HelpSearchResult } from "~/lib/help";
import { ContactSupport } from "./ContactSupport";

const POPULAR_QUERIES = [
  "create an account",
  "send a gift",
  "withdraw earnings",
  "verify email",
  "create a community",
  "set up a store",
];

export function HelpSearch() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<HelpSearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contactOpen, setContactOpen] = useState(false);
  const controller = useRef<AbortController | null>(null);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setError(null);
      return;
    }
    controller.current?.abort();
    const ac = new AbortController();
    controller.current = ac;
    setResults([]);
    setOpen(false);
    setBusy(true);
    setError(null);
    const t = setTimeout(async () => {
      try {
        const r = await searchHelp(q, 8);
        if (!ac.signal.aborted) {
          setResults(r);
          setOpen(true);
        }
      } catch {
        if (!ac.signal.aborted) setError("Search is temporarily unavailable.");
      } finally {
        if (!ac.signal.aborted) setBusy(false);
      }
    }, 250);
    return () => {
      clearTimeout(t);
      ac.abort();
    };
  }, [query]);

  function go(slug: string) {
    setOpen(false);
    setQuery("");
    navigate(`/help/article/${encodeURIComponent(slug)}`);
  }

  return (
    <div className="w-full">
      <div className="flex items-center gap-2 rounded-2xl border border-[#D6E0E8] bg-white px-4 py-3 shadow-[0px_4px_12px_rgba(16,40,64,0.06)] transition-all focus-within:border-[#2164b6] focus-within:ring-4 focus-within:ring-[#2164b6]/10">
        <Search className="size-5 shrink-0 text-[#98A2B3]" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query.trim().length >= 2 && setOpen(true)}
          placeholder='Search help articles, e.g. "how do I send a gift?"'
          aria-label="Search help"
          className="h-6 flex-1 bg-transparent text-[15px] text-[#102840] placeholder:text-[#98A2B3] outline-none"
        />
        {busy && <span className="size-4 animate-spin rounded-full border-2 border-[#2164b6] border-t-transparent" />}
        {query && (
          <button
            onClick={() => {
              setQuery("");
              setOpen(false);
            }}
            aria-label="Clear search"
            className="rounded-md p-1 text-[#98A2B3] transition-colors hover:bg-[#F0F5F8] hover:text-[#102840]"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      {error && <p className="mt-2 px-1 text-sm text-[#DC2626]">{error}</p>}

      {open && query.trim().length >= 2 && (
        <div className="mt-2 overflow-hidden rounded-2xl border border-[#D6E0E8] bg-white shadow-lg shadow-[rgba(16,40,64,0.08)]">
          {results.length === 0 ? (
            <div className="px-4 py-5">
              <p className="text-sm text-[#667085]">
                No articles match "{query}". Try different keywords.
              </p>
              <button
                onClick={() => {
                  setOpen(false);
                  setContactOpen(true);
                }}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-[#2164b6] px-3.5 py-2 text-[13px] font-bold text-white transition-colors hover:bg-[#1b52a0]"
              >
                <LifeBuoy className="size-4" />
                Couldn't find what you need? Contact support
              </button>
            </div>
          ) : (
            <ul className="divide-y divide-[#F0F5F8]">
              {results.map((r) => (
                <li key={r.slug}>
                  <button
                    onClick={() => go(r.slug)}
                    className="group flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[#F0F5F8]"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-bold uppercase tracking-wide text-[#2164b6]">
                        {r.category_name ?? "Help"}
                      </p>
                      <p className="mt-0.5 truncate text-sm font-semibold text-[#102840] group-hover:text-[#2164b6]">
                        {r.title}
                      </p>
                      {r.excerpt && (
                        <p className="mt-0.5 line-clamp-1 text-xs text-[#98A2B3]">{r.excerpt}</p>
                      )}
                    </div>
                    <ArrowUpRight className="size-4 shrink-0 text-[#B7C6D1] group-hover:text-[#2164b6]" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {contactOpen && (
        <div className="mt-4">
          <ContactSupport
            context={{ search_query: query, current_page: "/help" }}
            onClose={() => setContactOpen(false)}
          />
        </div>
      )}

      <p className="mt-4 text-center text-[11px] font-semibold uppercase tracking-wider text-[#98A2B3]">
        Popular:
      </p>
      <div className="mt-1.5 flex flex-wrap justify-center gap-2">
        {POPULAR_QUERIES.map((q) => (
          <button
            key={q}
            onClick={() => setQuery(q)}
            className="rounded-full border border-[#D6E0E8] bg-white px-3 py-1 text-[12px] font-medium text-[#667085] transition-colors hover:border-[#2164b6]/50 hover:text-[#2164b6]"
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}