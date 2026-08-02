import { useState, useRef, useEffect } from "react";
import {
  Bot, Send, Zap, RefreshCw, TrendingUp,
  Users, FileText, MessageCircle, ShoppingBag, Wand2, MailCheck, Loader2,
} from "lucide-react";
import { getAuthToken } from "@/lib/auth/token";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "react-router";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000/api/v1";

function getAuthHeaders() {
  const token = getAuthToken();
  return { "Content-Type": "application/json", Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  at: number;
}

const SUGGESTIONS = [
  { icon: TrendingUp, label: "Content strategy ideas", query: "What content should I create to grow my audience this month?" },
  { icon: Users, label: "Community tips", query: "How can I increase engagement in my community?" },
  { icon: FileText, label: "Write a post", query: "Help me write an engaging post about my latest project" },
  { icon: MessageCircle, label: "Message templates", query: "Give me a professional message template for reaching out to collaborators" },
  { icon: ShoppingBag, label: "Pricing advice", query: "How should I price my digital products and memberships?" },
  { icon: Wand2, label: "Brainstorm ideas", query: "Help me brainstorm creative ideas for my brand" },
];

function TypingDots() {
  return (
    <div className="flex gap-1.5 px-1 py-2">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-2 w-2 rounded-full bg-gradient-to-br from-[#38A8D8] to-[#1a6b9e] animate-bounce"
          style={{ animationDelay: `${i * 150}ms`, animationDuration: "0.8s" }}
        />
      ))}
    </div>
  );
}

export default function AiAssistantPage() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [code, setCode] = useState("");
  const [verifyMsg, setVerifyMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [sent, setSent] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async (text?: string) => {
    const content = text ?? input;
    if (!content.trim() || busy) return;
    setShowSuggestions(false);
    const userMsg: ChatMessage = { role: "user", content: content.trim(), at: Date.now() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/ai/chat`, {
        method: "POST", headers: getAuthHeaders(),
        body: JSON.stringify({ message: userMsg.content }),
      });
      const j = await res.json();
      const data = j?.success ? j?.data : j;
      const reply = data?.reply ?? data?.message ?? "Sorry, I couldn't process that.";
      setMessages((prev) => [...prev, { role: "assistant", content: reply, at: Date.now() }]);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Something went wrong. Please try again.", at: Date.now() }]);
    } finally { setBusy(false); }
  };

  const clearChat = () => {
    setMessages([]);
    setShowSuggestions(true);
  };

  const sendCode = async () => {
    setSent(true);
    setVerifyMsg(null);
    try {
      const res = await fetch(`${API_BASE}/auth/email/send-code`, { method: "POST", headers: getAuthHeaders() });
      const j = await res.json();
      if (!res.ok) setVerifyMsg({ ok: false, text: j?.message ?? "Could not send code." });
    } catch {
      setVerifyMsg({ ok: false, text: "Could not send code. Please try again." });
    }
  };

  const verify = async () => {
    if (!/^\d{6}$/.test(code)) return;
    setVerifying(true);
    setVerifyMsg(null);
    try {
      const res = await fetch(`${API_BASE}/auth/email/verify-code`, {
        method: "POST", headers: getAuthHeaders(),
        body: JSON.stringify({ code }),
      });
      const j = await res.json();
      if (!res.ok) {
        setVerifyMsg({ ok: false, text: j?.message ?? "Invalid code." });
        return;
      }
      window.location.reload();
    } catch {
      setVerifyMsg({ ok: false, text: "Could not verify. Please try again." });
    } finally {
      setVerifying(false);
    }
  };

  if (user && user.email_verified === false) {
    return (
      <div className="flex min-h-[calc(100svh-112px)] items-center justify-center bg-gradient-to-br from-[#F8FAFB] via-white to-[#E8F8FF]/40 dark:from-[#0a1a2a] dark:via-[#0f1f30] dark:to-[#0a1a2a] p-6">
        <div className="w-full max-w-md border border-border rounded-2xl bg-card p-8 space-y-5 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-[#38A8D8] to-[#1a6b9e] flex items-center justify-center shadow-md shadow-[#38A8D8]/20">
              <MailCheck className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-black text-foreground tracking-tight">Verify your email</h1>
              <p className="text-[11px] text-muted-foreground">Unlock Mera to continue.</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            We sent a 6-digit code to <span className="font-bold text-foreground">{user.email}</span>. Enter it below to
            verify your account and start chatting with Mera.
          </p>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            onKeyDown={(e) => e.key === "Enter" && verify()}
            placeholder="6-digit code"
            inputMode="numeric"
            className="w-full rounded-xl border border-border bg-background px-4 py-3 text-center text-2xl font-black tracking-[0.5em] text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-[#38A8D8]/20"
          />
          {verifyMsg && (
            <p className={`text-[11px] font-semibold ${verifyMsg.ok ? "text-emerald-600" : "text-rose-500"}`}>{verifyMsg.text}</p>
          )}
          <button
            onClick={verify}
            disabled={verifying || !/^\d{6}$/.test(code)}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-[#38A8D8] to-[#2e8ab8] text-white text-sm font-bold hover:from-[#2e8ab8] hover:to-[#256e91] disabled:opacity-40 transition-all shadow-sm hover:shadow-md hover:shadow-[#38A8D8]/20"
          >
            {verifying ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : "Verify & unlock Mera"}
          </button>
          <button
            onClick={sendCode}
            className="w-full text-center text-[11px] font-bold text-[#38A8D8] hover:underline underline-offset-2"
          >
            {sent ? "Resend code" : "Send code"}
          </button>
          <p className="text-[10px] text-muted-foreground text-center">
            Not sure?{" "}
            <Link to="/app/onboarding" className="font-bold text-[#38A8D8] hover:underline underline-offset-2">
              Verify during onboarding
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100svh-112px)] overflow-hidden bg-gradient-to-br from-[#F8FAFB] via-white to-[#E8F8FF]/40 dark:from-[#0a1a2a] dark:via-[#0f1f30] dark:to-[#0a1a2a]">
      <div className="flex flex-col w-full max-w-7xl mx-auto">
        {/* Header */}
        <div className="shrink-0 px-6 pt-6 pb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-[#38A8D8] to-[#1a6b9e] flex items-center justify-center shadow-md shadow-[#38A8D8]/20">
                <Bot className="h-5 w-5 text-white" />
              </div>
              <div className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 border-2 border-white dark:border-[#0f1f30]" />
            </div>
            <div>
              <h1 className="text-lg font-black text-foreground tracking-tight">AI Assistant</h1>
              <p className="text-[11px] text-muted-foreground/70 flex items-center gap-1">
                <Zap className="h-3 w-3 text-[#38A8D8]" />
                Powered by advanced intelligence
              </p>
            </div>
          </div>
          {messages.length > 0 && (
            <button
              onClick={clearChat}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all border border-transparent hover:border-border"
            >
              <RefreshCw className="h-3.5 w-3.5" /> New chat
            </button>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 space-y-5 pb-4 scrollbar-thin">
          {messages.length === 0 && showSuggestions && (
            <div className="pt-8 pb-4 text-center space-y-6">
              <div className="space-y-2">
                <div className="mx-auto w-16 h-16 rounded-3xl bg-gradient-to-br from-[#38A8D8]/15 to-purple-500/15 flex items-center justify-center border border-[#38A8D8]/10">
                  <Zap className="h-7 w-7 text-[#38A8D8]" />
                </div>
                <h2 className="text-xl font-black text-foreground tracking-tight">How can I help you?</h2>
                <p className="text-sm text-muted-foreground/60 max-w-md mx-auto">
                  Ask me anything about content creation, community management, marketing, or growing your brand.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-w-2xl mx-auto">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s.label}
                    onClick={() => send(s.query)}
                    className="flex items-center gap-3 px-4 py-3.5 rounded-2xl border border-border/60 bg-white dark:bg-[#102840]/60 hover:border-[#38A8D8]/30 hover:bg-[#38A8D8]/5 hover:shadow-sm hover:shadow-[#38A8D8]/5 transition-all duration-200 text-left group"
                  >
                    <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-[#38A8D8]/10 to-purple-500/10 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      <s.icon className="h-4 w-4 text-[#38A8D8]" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-foreground truncate">{s.label}</p>
                      <p className="text-[10px] text-muted-foreground/50 truncate">{s.query.length > 50 ? `${s.query.slice(0, 50)}...` : s.query}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : ""} ${m.role === "user" ? "animate-in slide-in-from-right-2 fade-in" : "animate-in slide-in-from-left-2 fade-in"} duration-200`}>
              <div className={`h-8 w-8 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${
                m.role === "assistant"
                  ? "bg-gradient-to-br from-[#38A8D8] to-[#1a6b9e] text-white"
                  : "bg-gradient-to-br from-[#102840] to-[#1a2e4a] text-white"
              }`}>
                {m.role === "assistant" ? <Bot className="h-4 w-4" /> : <MessageCircle className="h-4 w-4" />}
              </div>
              <div className={`max-w-[75%] ${m.role === "user" ? "order-first" : ""}`}>
                <div className={`px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap break-words ${
                  m.role === "assistant"
                    ? "bg-white dark:bg-[#102840] border border-border/50 text-foreground rounded-2xl rounded-tl-sm shadow-sm"
                    : "bg-gradient-to-r from-[#38A8D8] to-[#2e8ab8] text-white rounded-2xl rounded-tr-sm shadow-sm shadow-[#38A8D8]/10"
                }`}>
                  {m.content}
                </div>
                <p className={`text-[10px] text-muted-foreground/40 mt-1 ${m.role === "user" ? "text-right" : ""}`}>
                  {new Date(m.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>
          ))}

          {busy && (
            <div className="flex gap-3 animate-in fade-in slide-in-from-left-2 duration-200">
              <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-[#38A8D8] to-[#1a6b9e] flex items-center justify-center shrink-0 shadow-sm">
                <Bot className="h-4 w-4 text-white" />
              </div>
              <div className="bg-white dark:bg-[#102840] border border-border/50 rounded-2xl rounded-tl-sm px-4 py-2 shadow-sm">
                <TypingDots />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Composer */}
        <div className="shrink-0 px-6 pb-6 pt-2">
          <div className="relative max-w-3xl mx-auto">
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-[#38A8D8]/5 to-purple-500/5 blur-xl" />
            <div className="relative flex items-center gap-2 bg-white dark:bg-[#102840] border border-border/60 rounded-2xl px-4 py-2.5 shadow-sm focus-within:border-[#38A8D8]/30 focus-within:shadow-md focus-within:shadow-[#38A8D8]/5 transition-all">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                placeholder="Ask me anything..."
                className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/40 outline-none"
              />
              <div className="flex items-center gap-1">
                <button
                  onClick={() => send()}
                  disabled={!input.trim() || busy}
                  className="p-2 rounded-xl bg-gradient-to-r from-[#38A8D8] to-[#2e8ab8] text-white hover:from-[#2e8ab8] hover:to-[#256e91] disabled:opacity-40 transition-all shrink-0 shadow-sm hover:shadow-md hover:shadow-[#38A8D8]/20 disabled:shadow-none"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
            <p className="text-[10px] text-center text-muted-foreground/30 mt-2">
              AI responses are generated by machine learning. Verify important information.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
