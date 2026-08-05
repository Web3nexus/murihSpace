import { useState, useRef, useEffect, useMemo } from "react";
import { Link } from "react-router";
import {
  Rocket, UserCircle, Sparkles, Gift, Wallet, Users, ShoppingBag, Crown, ShieldCheck,
  Search, Bot, Send, Loader2, ChevronLeft, ChevronRight, Menu, X, MessageCircle,
  BookOpen, ArrowUpRight, ChevronDown, RefreshCw, ExternalLink, HelpCircle,
} from "lucide-react";
import {
  HELP_CATEGORIES, HELP_ARTICLES, articlesInCategory, categoryById,
  articleBodyText, searchHelp,
} from "@/data/helpCenter";
import type { HelpArticle, HelpCategory } from "@/data/helpCenter";
import { useAuth } from "@/hooks/useAuth";
import { getAuthToken } from "@/lib/auth/token";

const API_BASE = (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL) ?? "http://localhost:8000/api/v1";

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  "getting-started": <Rocket className="h-4.5 w-4.5" />,
  account: <UserCircle className="h-4.5 w-4.5" />,
  creators: <Sparkles className="h-4.5 w-4.5" />,
  gifting: <Gift className="h-4.5 w-4.5" />,
  murihpay: <Wallet className="h-4.5 w-4.5" />,
  communities: <Users className="h-4.5 w-4.5" />,
  store: <ShoppingBag className="h-4.5 w-4.5" />,
  subscriptions: <Crown className="h-4.5 w-4.5" />,
  security: <ShieldCheck className="h-4.5 w-4.5" />,
};

function categoryIcon(id: string) {
  return CATEGORY_ICONS[id] ?? <HelpCircle className="h-4.5 w-4.5" />;
}

function getAuthHeaders() {
  const token = getAuthToken();
  return { "Content-Type": "application/json", Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  at: number;
  sources?: string[];
}

const SUGGESTED_QUESTIONS = [
  "How do I create an account?",
  "How do I send an anonymous gift?",
  "How do I withdraw my earnings?",
  "What is a Creator Wallet?",
  "How do I verify my email?",
  "How do I create a community?",
];

function TypingDots() {
  return (
    <div className="flex gap-1 px-1 py-1">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-[#2164b6] animate-bounce"
          style={{ animationDelay: `${i * 150}ms`, animationDuration: "0.8s" }}
        />
      ))}
    </div>
  );
}

export default function HelpCenterPage() {
  const { isAuthenticated } = useAuth();

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const searchResults = useMemo(() => {
    const q = query.trim();
    if (q.length < 2) return [];
    return searchHelp(q, 8);
  }, [query]);

  const activeArticle: HelpArticle | undefined =
    HELP_ARTICLES.find((a) => a.id === selectedArticle);

  useEffect(() => {
    if (messages.length === 0) return;
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  function openArticle(id: string) {
    const a = HELP_ARTICLES.find((x) => x.id === id);
    if (a) setSelectedCategory(a.categoryId);
    setSelectedArticle(id);
    setQuery("");
    setMobileNavOpen(false);
  }

  function goBackToList() {
    setSelectedArticle(null);
    setSelectedCategory(null);
  }

  const send = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || busy) return;
    setMessages((prev) => [...prev, { role: "user", content, at: Date.now() }]);
    setInput("");
    setBusy(true);

    // RAG guard-rail: retrieve the most relevant help docs and inject them
    const docs = searchHelp(content, 4);
    const sources = docs.map((d) => d.id);

    let guard = "";
    if (docs.length > 0) {
      const docText = docs
        .map(
          (d) =>
            `[${categoryById(d.categoryId)?.label ?? "Help"} - ${d.title}]\n${articleBodyText(d)}`
        )
        .join("\n\n---\n\n");
      guard =
        "\n\nUse the MurihSpace Help Center documentation below to answer the user's question. Base your answer on this documentation. If the answer is not covered, say you will connect the user with a human support agent and keep it brief.\n\n" +
        docText;
    }

    try {
      const res = await fetch(`${API_BASE}/ai/chat`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ message: content + guard }),
      });
      const j = await res.json();
      if (res.status === 403) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content:
              "Please verify your email address first to chat with the assistant. Head to Settings and complete verification, then come back!",
            at: Date.now(),
          },
        ]);
      } else {
        const data = j?.success ? j?.data : j;
        const reply = data?.reply ?? data?.message ?? "Sorry, I couldn't process that.";
        setMessages((prev) => [...prev, { role: "assistant", content: reply, at: Date.now(), sources: sources.length ? sources : undefined }]);
      }
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Something went wrong. Please try again.", at: Date.now() }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* ── Top bar ── */}
      <header className="sticky top-0 z-40 border-b border-slate-200/80 dark:border-slate-800/80 bg-white/85 dark:bg-slate-950/85 backdrop-blur-md">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          <button
            onClick={() => setMobileNavOpen((v) => !v)}
            className="lg:hidden p-2 -ml-1 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Toggle help categories"
          >
            <Menu className="h-5 w-5" />
          </button>
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <img src="/logos/member-logo-light.png" alt="MurihSpace" className="h-6 w-auto object-contain dark:hidden" />
            <img src="/logos/member-logo-dark.png" alt="MurihSpace" className="h-6 w-auto object-contain hidden dark:block" />
            <span className="hidden sm:inline text-xs font-bold text-slate-400 dark:text-slate-500 ml-1">Help Center</span>
          </Link>
          <div className="flex-1" />
          {isAuthenticated ? (
            <Link
              to="/app"
              className="text-xs font-bold text-[#2164b6] dark:text-[#7ab0ff] hover:underline underline-offset-4"
            >
              Back to app →
            </Link>
          ) : (
            <Link
              to="/login"
              className="px-4 py-2 rounded-xl bg-[#2164b6] hover:bg-[#1a5091] text-white text-xs font-bold transition-colors shadow-sm"
            >
              Log in
            </Link>
          )}
        </div>
      </header>

      {/* ── Hero search ── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#2164b6] via-[#2a76cf] to-[#38A8D8] dark:from-[#12356b] dark:via-[#1a4d8f] dark:to-[#2a6a9e]">
        <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ backgroundImage: "radial-gradient(circle at 20% 20%, white 1px, transparent 1px)", backgroundSize: "28px 28px" }} />
        <div className="relative max-w-[1400px] mx-auto px-4 sm:px-6 py-10 sm:py-14 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 text-white/90 text-[11px] font-semibold mb-4 backdrop-blur-sm">
            <BookOpen className="h-3.5 w-3.5" /> How can we help you today?
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white">MurihSpace Help Center</h1>
          <p className="mt-2 text-sm sm:text-base text-white/80 max-w-xl mx-auto">
            Find answers about accounts, creators, gifting, MurihPay and more — or ask our AI assistant.
          </p>
          <div className="mt-6 max-w-xl mx-auto">
            <div className="flex items-center gap-2 bg-white dark:bg-slate-900 rounded-2xl px-4 py-3 shadow-lg shadow-black/10 focus-within:ring-4 focus-within:ring-white/20 transition-all">
              <Search className="h-5 w-5 text-slate-400 shrink-0" />
              <input
                value={query}
                onChange={(e) => { setQuery(e.target.value); setSelectedArticle(null); }}
                placeholder="Search help articles, e.g. 'how do I send a gift?'"
                className="flex-1 bg-transparent text-sm text-slate-900 dark:text-white placeholder:text-slate-400 outline-none"
              />
              {query && (
                <button onClick={() => setQuery("")} className="p-1 text-slate-400 hover:text-slate-600 transition-colors" aria-label="Clear search">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── Body: left nav | main | AI ── */}
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 grid grid-cols-1 lg:grid-cols-[240px_1fr_340px] gap-6">
        {/* Left nav */}
        <aside
          className={`lg:sticky lg:top-[72px] lg:max-h-[calc(100vh-90px)] lg:overflow-y-auto scrollbar-thin fixed inset-y-0 left-0 z-50 w-72 lg:w-full bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 lg:border-0 lg:bg-transparent lg:dark:bg-transparent p-5 lg:p-0 transition-transform ${
            mobileNavOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
          }`}
        >
          <div className="lg:hidden flex items-center justify-between mb-4">
            <span className="text-sm font-black">Help topics</span>
            <button onClick={() => setMobileNavOpen(false)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Close">
              <X className="h-4 w-4" />
            </button>
          </div>
          <button
            onClick={goBackToList}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left text-sm font-semibold transition-colors ${
              selectedArticle === null && selectedCategory === null
                ? "bg-[#2164b6]/10 text-[#2164b6] dark:text-[#7ab0ff]"
                : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            <BookOpen className="h-4.5 w-4.5" /> All topics
          </button>
          <div className="mt-2 space-y-1">
            {HELP_CATEGORIES.map((cat) => {
              const active = selectedCategory === cat.id || (activeArticle?.categoryId === cat.id);
              return (
                <div key={cat.id} className="rounded-xl">
                  <button
                    onClick={() => {
                      setSelectedCategory(cat.id);
                      setSelectedArticle(null);
                      setMobileNavOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                      active ? "bg-[#2164b6]/10 text-[#2164b6] dark:text-[#7ab0ff]" : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      {categoryIcon(cat.id)} {cat.label}
                    </span>
                    <ChevronRight className={`h-3.5 w-3.5 transition-transform ${active ? "rotate-90" : "text-slate-400"}`} />
                  </button>
                  {active && (
                    <div className="mt-1 ml-5 pl-2 border-l border-slate-200 dark:border-slate-800 space-y-0.5">
                      {articlesInCategory(cat.id).map((a) => (
                        <button
                          key={a.id}
                          onClick={() => openArticle(a.id)}
                          className={`w-full text-left px-3 py-1.5 rounded-lg text-[13px] transition-colors ${
                            selectedArticle === a.id
                              ? "bg-[#2164b6]/10 text-[#2164b6] dark:text-[#7ab0ff] font-semibold"
                              : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                          }`}
                        >
                          {a.title}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </aside>

        {/* Main content */}
        <main className="min-w-0">
          {/* Search results */}
          {query.trim().length >= 2 ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-black">
                <Search className="h-4 w-4 text-[#2164b6]" />
                Search results
                <span className="text-xs font-semibold text-slate-400">({searchResults.length})</span>
              </div>
              {searchResults.length === 0 ? (
                <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-10 text-center">
                  <Search className="h-8 w-8 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
                  <p className="text-sm font-semibold">No articles match "{query}"</p>
                  <p className="text-xs text-slate-500 mt-1">Try different keywords, or ask the AI assistant on the right.</p>
                </div>
              ) : (
                searchResults.map((a) => {
                  const cat = categoryById(a.categoryId);
                  return (
                    <button
                      key={a.id}
                      onClick={() => openArticle(a.id)}
                      className="w-full text-left rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 hover:border-[#2164b6]/40 hover:shadow-sm transition-all group"
                    >
                      <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-[#2164b6] dark:text-[#7ab0ff]">
                        {categoryIcon(a.categoryId)} {cat?.label}
                      </div>
                      <h3 className="mt-1.5 text-sm font-bold group-hover:text-[#2164b6] dark:group-hover:text-[#7ab0ff] transition-colors">
                        {a.title}
                      </h3>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 line-clamp-2">{a.excerpt}</p>
                    </button>
                  );
                })
              )}
            </div>
          ) : activeArticle ? (
            <ArticleView article={activeArticle} onBack={goBackToList} onOpenArticle={openArticle} />
          ) : selectedCategory ? (
            <CategoryView category={categoryById(selectedCategory)!} onOpenArticle={openArticle} />
          ) : (
            <WelcomeView onOpenArticle={openArticle} onSelectCategory={(id) => setSelectedCategory(id)} />
          )}
        </main>

        {/* AI assistant sidebar */}
        <aside className="lg:sticky lg:top-[72px] lg:h-[calc(100vh-90px)]">
          <div className="flex flex-col h-[480px] sm:h-[560px] lg:h-full rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
            {/* AI header */}
            <div className="shrink-0 px-4 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-[#2164b6]/5 to-[#38A8D8]/5">
              <div className="flex items-center gap-2.5">
                <div className="relative">
                  <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-[#2164b6] to-[#38A8D8] flex items-center justify-center shadow-sm">
                    <Bot className="h-4.5 w-4.5 text-white" />
                  </div>
                  <div className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900" />
                </div>
                <div>
                  <h3 className="text-sm font-black tracking-tight">Ask the assistant</h3>
                  <p className="text-[10px] text-slate-400">Answers from our help articles</p>
                </div>
              </div>
              <button
                onClick={() => setMessages([])}
                disabled={messages.length === 0}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-30"
                aria-label="New chat"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col">
                  <div className="flex items-start gap-2.5">
                    <div className="h-8 w-8 shrink-0 rounded-xl bg-gradient-to-br from-[#2164b6] to-[#38A8D8] flex items-center justify-center">
                      <Bot className="h-4 w-4 text-white" />
                    </div>
                    <div className="bg-slate-100 dark:bg-slate-800 rounded-2xl rounded-tl-sm px-3.5 py-2.5 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                      Hi! I'm here to help with MurihSpace. Ask me anything about accounts, gifting, wallets, communities or creating.
                    </div>
                  </div>
                  <div className="mt-5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Try asking</p>
                    <div className="flex flex-wrap gap-1.5">
                      {SUGGESTED_QUESTIONS.map((q) => (
                        <button
                          key={q}
                          onClick={() => send(q)}
                          disabled={busy}
                          className="text-left text-[11px] font-semibold px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-[#2164b6]/50 hover:text-[#2164b6] dark:hover:text-[#7ab0ff] transition-colors disabled:opacity-40"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                  {!isAuthenticated && (
                    <div className="mt-auto pt-4">
                      <div className="rounded-2xl border border-[#2164b6]/20 bg-[#2164b6]/5 p-4">
                        <p className="text-xs font-bold text-slate-700 dark:text-slate-200">Unlock the AI assistant</p>
                        <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                          Log in to chat with the assistant — it answers using our help articles and points you to the right steps.
                        </p>
                        <Link to="/login" className="mt-3 inline-flex px-4 py-2 rounded-xl bg-[#2164b6] hover:bg-[#1a5091] text-white text-[11px] font-bold transition-colors">
                          Log in to chat
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                messages.map((m, i) => (
                  <div key={i} className={`flex gap-2.5 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
                    <div className={`h-8 w-8 shrink-0 rounded-xl flex items-center justify-center shadow-sm ${
                      m.role === "assistant"
                        ? "bg-gradient-to-br from-[#2164b6] to-[#38A8D8] text-white"
                        : "bg-slate-800 text-white"
                    }`}>
                      {m.role === "assistant" ? <Bot className="h-4 w-4" /> : <MessageCircle className="h-4 w-4" />}
                    </div>
                    <div className={`max-w-[80%] ${m.role === "user" ? "order-first" : ""}`}>
                      <div className={`px-3.5 py-2.5 text-xs leading-relaxed whitespace-pre-wrap break-words ${
                        m.role === "assistant"
                          ? "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-2xl rounded-tl-sm"
                          : "bg-[#2164b6] text-white rounded-2xl rounded-tr-sm"
                      }`}>
                        {m.content}
                      </div>
                      {m.sources && m.sources.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {m.sources.map((sid) => {
                            const a = HELP_ARTICLES.find((x) => x.id === sid);
                            if (!a) return null;
                            return (
                              <button
                                key={sid}
                                onClick={() => openArticle(sid)}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-[#2164b6]/10 text-[#2164b6] dark:text-[#7ab0ff] text-[10px] font-semibold hover:bg-[#2164b6]/20 transition-colors"
                              >
                                <ArrowUpRight className="h-3 w-3" /> {a.title}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
              {busy && (
                <div className="flex gap-2.5">
                  <div className="h-8 w-8 shrink-0 rounded-xl bg-gradient-to-br from-[#2164b6] to-[#38A8D8] flex items-center justify-center">
                    <Bot className="h-4 w-4 text-white" />
                  </div>
                  <div className="bg-slate-100 dark:bg-slate-800 rounded-2xl rounded-tl-sm px-3 py-2">
                    <TypingDots />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Composer */}
            <div className="shrink-0 p-3 border-t border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 rounded-xl px-3 py-2">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                  placeholder={isAuthenticated ? "Ask a question…" : "Log in to chat"}
                  disabled={!isAuthenticated}
                  className="flex-1 bg-transparent text-xs text-slate-900 dark:text-white placeholder:text-slate-400 outline-none disabled:opacity-50"
                />
                <button
                  onClick={() => send()}
                  disabled={!input.trim() || busy || !isAuthenticated}
                  className="p-2 rounded-lg bg-[#2164b6] hover:bg-[#1a5091] text-white disabled:opacity-40 transition-colors shrink-0"
                  aria-label="Send message"
                >
                  {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                </button>
              </div>
              <p className="text-[9px] text-slate-400 text-center mt-1.5">
                AI answers use our help articles. Verify important information.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

/* ── Sub-views ─────────────────────────────────────────── */

function WelcomeView({
  onOpenArticle,
  onSelectCategory,
}: {
  onOpenArticle: (id: string) => void;
  onSelectCategory: (id: string) => void;
}) {
  const popular = ["create-account", "send-gift", "payouts", "wallet-types", "verify-email", "create-community"];
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-black tracking-tight">Popular topics</h2>
        <div className="mt-3 grid sm:grid-cols-2 gap-2.5">
          {popular.map((id) => {
            const a = HELP_ARTICLES.find((x) => x.id === id);
            if (!a) return null;
            return (
              <button
                key={id}
                onClick={() => onOpenArticle(id)}
                className="text-left rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 hover:border-[#2164b6]/40 hover:shadow-sm transition-all group"
              >
                <p className="text-[11px] font-bold uppercase tracking-wide text-[#2164b6] dark:text-[#7ab0ff]">
                  {categoryById(a.categoryId)?.label}
                </p>
                <p className="mt-1 text-sm font-bold group-hover:text-[#2164b6] dark:group-hover:text-[#7ab0ff] transition-colors">
                  {a.title}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <h2 className="text-lg font-black tracking-tight">Browse by topic</h2>
        <div className="mt-3 grid sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {HELP_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => onSelectCategory(cat.id)}
              className="text-left rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 hover:border-[#2164b6]/40 hover:shadow-sm hover:-translate-y-0.5 transition-all group"
            >
              <div className="h-9 w-9 rounded-xl bg-[#2164b6]/10 text-[#2164b6] dark:text-[#7ab0ff] flex items-center justify-center group-hover:scale-105 transition-transform">
                {categoryIcon(cat.id)}
              </div>
              <p className="mt-2.5 text-sm font-bold group-hover:text-[#2164b6] dark:group-hover:text-[#7ab0ff] transition-colors">{cat.label}</p>
              <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">{cat.blurb}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function CategoryView({
  category,
  onOpenArticle,
}: {
  category: HelpCategory;
  onOpenArticle: (id: string) => void;
}) {
  const articles = articlesInCategory(category.id);
  return (
    <div>
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-2xl bg-[#2164b6]/10 text-[#2164b6] dark:text-[#7ab0ff] flex items-center justify-center">
          {categoryIcon(category.id)}
        </div>
        <div>
          <h2 className="text-lg font-black tracking-tight">{category.label}</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">{category.blurb}</p>
        </div>
      </div>
      <div className="mt-4 space-y-2">
        {articles.map((a) => (
          <button
            key={a.id}
            onClick={() => onOpenArticle(a.id)}
            className="w-full text-left rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 hover:border-[#2164b6]/40 hover:shadow-sm transition-all group"
          >
            <p className="text-sm font-bold group-hover:text-[#2164b6] dark:group-hover:text-[#7ab0ff] transition-colors">{a.title}</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 line-clamp-2">{a.excerpt}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

function ArticleView({
  article,
  onBack,
  onOpenArticle,
}: {
  article: HelpArticle;
  onBack: () => void;
  onOpenArticle: (id: string) => void;
}) {
  const cat = categoryById(article.categoryId);
  const [tocOpen, setTocOpen] = useState(false);
  return (
    <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
      <div className="border-b border-slate-200 dark:border-slate-800 px-5 sm:px-8 py-4 flex items-center justify-between gap-3">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> All topics
        </button>
        <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-[#2164b6] dark:text-[#7ab0ff]">
          {categoryIcon(article.categoryId)} {cat?.label}
        </div>
      </div>
      <div className="px-5 sm:px-8 py-6 sm:py-8">
        <h1 className="text-xl sm:text-2xl font-black tracking-tight leading-snug">{article.title}</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{article.excerpt}</p>

        {/* Inline TOC */}
        <button
          onClick={() => setTocOpen((v) => !v)}
          className="mt-4 w-full flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 px-4 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:border-[#2164b6]/40 transition-colors"
        >
          In this article
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${tocOpen ? "rotate-180" : ""}`} />
        </button>
        {tocOpen && (
          <div className="mt-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2">
            {article.sections.map((s, i) => (
              <a
                key={i}
                href={`#${article.id}-${i}`}
                className="block px-3 py-1.5 rounded-lg text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-[#2164b6] dark:hover:text-[#7ab0ff] transition-colors"
              >
                {s.heading}
              </a>
            ))}
          </div>
        )}

        <div className="mt-6 space-y-5">
          {article.sections.map((s, i) => (
            <section key={i} id={`${article.id}-${i}`} className="scroll-mt-24">
              <h2 className="flex items-center gap-2 text-base font-bold tracking-tight">
                <span className="h-1.5 w-1.5 rounded-full bg-[#2164b6] shrink-0" />
                {s.heading}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{s.body}</p>
            </section>
          ))}
        </div>

        {article.related && article.related.length > 0 && (
          <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-800">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Related articles</p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {article.related.map((rid) => {
                const r = HELP_ARTICLES.find((x) => x.id === rid);
                if (!r) return null;
                return (
                  <button
                    key={rid}
                    onClick={() => onOpenArticle(rid)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700 text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:border-[#2164b6]/50 hover:text-[#2164b6] dark:hover:text-[#7ab0ff] transition-colors"
                  >
                    <ExternalLink className="h-3 w-3" /> {r.title}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
