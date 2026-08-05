import { useState, useEffect, useCallback } from "react";
import { MessageSquare, Loader2, Send, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getAuthToken } from "@/lib/auth/token";

const API_BASE = (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL) ?? "http://localhost:8000/api/v1";

function getAuthHeaders() {
  const token = getAuthToken();
  return { "Content-Type": "application/json", Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

interface Thread {
  id: number; subject: string; status: "open" | "closed";
  last_message?: string; unread: boolean; created_at: string;
}

export default function SupportThreadsPage() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [messages, setMessages] = useState<{ id: number; content: string; from_admin: boolean; created_at: string }[]>([]);
  const [newMsg, setNewMsg] = useState("");
  const [sending, setSending] = useState(false);

  const fetchThreads = useCallback(async () => {
    setFetchError(null);
    try {
      const res = await fetch(`${API_BASE}/support/threads`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed to load threads");
      const j = await res.json();
      const list = j?.success ? j?.data : j;
      setThreads(list?.data ?? list ?? []);
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : "Failed to load threads");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchThreads(); }, [fetchThreads]);

  const openThread = async (id: number) => {
    setSelected(id);
    try {
      const res = await fetch(`${API_BASE}/support/threads/${id}/messages`, { headers: getAuthHeaders() });
      if (!res.ok) return;
      const j = await res.json();
      const list = j?.success ? j?.data : j;
      setMessages(list?.data ?? list ?? []);
    } catch { setMessages([]); }
  };

  const sendMessage = async () => {
    if (!newMsg.trim() || !selected) return;
    setSending(true);
    try {
      await fetch(`${API_BASE}/support/threads/${selected}/messages`, {
        method: "POST", headers: getAuthHeaders(),
        body: JSON.stringify({ content: newMsg.trim() }),
      });
      setNewMsg("");
      openThread(selected);
    } finally { setSending(false); }
  };

  if (loading) return <div className="flex justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-[#2164b6] dark:text-[#7ab0ff]" /></div>;

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 p-6 lg:p-8">
      <div>
        <h1 className="text-2xl font-black tracking-tight flex items-center gap-2.5">
          <MessageSquare className="h-6 w-6 text-[#2164b6] dark:text-[#7ab0ff]" /> Support Threads
        </h1>
        <p className="text-xs text-muted-foreground mt-1">Customer support ticket threads.</p>
      </div>

      {fetchError && (
        <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-xs text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" /> {fetchError}
          <button onClick={() => { setLoading(true); fetchThreads(); }} className="ml-auto text-muted-foreground hover:text-foreground font-bold">Retry</button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1 border border-border rounded-2xl bg-card overflow-hidden">
          <div className="p-3 border-b border-border">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Threads</p>
          </div>
          {threads.length === 0 ? (
            <div className="p-8 text-center">
              <MessageSquare className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">No threads</p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {threads.map((t) => (
                <button key={t.id} onClick={() => openThread(t.id)} className={`w-full text-left px-3 py-2.5 hover:bg-muted/10 transition-colors flex items-center gap-2 ${selected === t.id ? 'bg-muted/20' : ''}`}>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-foreground truncate flex items-center gap-1.5">
                      {t.unread && <span className="w-1.5 h-1.5 rounded-full bg-[#2164b6] shrink-0" />}
                      {t.subject}
                    </p>
                    {t.last_message && <p className="text-[10px] text-muted-foreground truncate mt-0.5">{t.last_message}</p>}
                  </div>
                  <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold shrink-0 ${t.status === 'open' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-muted text-muted-foreground'}`}>{t.status}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-2 border border-border rounded-2xl bg-card flex flex-col">
          {!selected ? (
            <div className="flex-1 flex items-center justify-center p-12">
              <div className="text-center">
                <MessageSquare className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm font-bold text-muted-foreground">Select a thread</p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex-1 p-4 space-y-3 overflow-y-auto max-h-[400px]">
                {messages.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-8">No messages yet.</p>
                ) : (
                  messages.map((m) => (
                    <div key={m.id} className={`flex ${m.from_admin ? 'justify-start' : 'justify-end'}`}>
                      <div className={`max-w-[80%] p-3 rounded-2xl text-xs ${m.from_admin ? 'bg-muted text-foreground' : 'bg-[#2164b6]/20 text-foreground'}`}>
                        <p>{m.content}</p>
                        <p className="text-[9px] text-muted-foreground mt-1">{new Date(m.created_at).toLocaleString()}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="p-3 border-t border-border flex gap-2">
                <Input value={newMsg} onChange={(e) => setNewMsg(e.target.value)} placeholder="Type a reply..." className="flex-1 text-xs" onKeyDown={(e) => e.key === 'Enter' && sendMessage()} />
                <Button size="sm" disabled={sending || !newMsg.trim()} onClick={sendMessage} className="h-9">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
