import { useState } from "react";
import { Sparkles, Loader2, Send, Bot, User } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000/api/v1";

function getAuthHeaders() {
  const token = localStorage.getItem("murihspace-token") || localStorage.getItem("auth_token");
  return { "Content-Type": "application/json", Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export default function AiAssistantPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: "Hi! I'm your AI assistant. Ask me anything about content creation, community management, or the platform." },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  const send = async () => {
    if (!input.trim() || busy) return;
    const userMsg: ChatMessage = { role: "user", content: input.trim() };
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
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Something went wrong. Please try again." }]);
    } finally { setBusy(false); }
  };

  return (
    <div className="w-full mx-auto max-w-[800px] space-y-6 p-6 lg:p-10">
      <h1 className="text-2xl font-black tracking-tight flex items-center gap-2.5"><Sparkles className="h-6 w-6 text-[#38A8D8]" /> AI Assistant</h1>
      <p className="text-xs text-muted-foreground -mt-4">AI-powered content and community assistant.</p>

      <div className="rounded-xl border bg-card flex flex-col h-[580px]">
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {messages.map((m, i) => (
            <div key={i} className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
              <div className={`h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 ${m.role === "assistant" ? "bg-[#38A8D8]/10" : "bg-muted"}`}>
                {m.role === "assistant" ? <Bot className="h-4 w-4 text-[#38A8D8]" /> : <User className="h-4 w-4" />}
              </div>
              <div className={`max-w-[75%] rounded-xl px-4 py-2.5 text-sm leading-relaxed ${m.role === "assistant" ? "bg-muted/50" : "bg-[#38A8D8] text-white"}`}>
                {m.content}
              </div>
            </div>
          ))}
          {busy && (
            <div className="flex gap-3">
              <div className="h-8 w-8 rounded-full bg-[#38A8D8]/10 flex items-center justify-center flex-shrink-0">
                <Bot className="h-4 w-4 text-[#38A8D8]" />
              </div>
              <div className="rounded-xl bg-muted/50 px-4 py-2.5"><Loader2 className="h-4 w-4 animate-spin" /></div>
            </div>
          )}
        </div>
        <div className="border-t p-3 flex items-center gap-2">
          <Input placeholder="Ask me anything..." className="text-xs" value={input}
            onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} />
          <Button size="sm" className="bg-[#38A8D8] hover:bg-[#2e8ab8] text-white px-3" onClick={send} disabled={busy}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
