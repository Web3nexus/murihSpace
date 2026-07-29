import { useState, useEffect, useCallback } from "react";
import { MessageCircle, Loader2, Send, Users, Search, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000/api/v1";

function getAuthHeaders() {
  const token = localStorage.getItem("murihspace-token") || localStorage.getItem("auth_token");
  return { "Content-Type": "application/json", Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

interface ChatRoom {
  id: number; name: string; member_count: number; last_message: string | null;
  last_activity: string | null; unread: number;
}

interface ChatMessage {
  id: number; content: string; created_at: string;
  user: { name: string; username: string };
}

export default function ChatPage() {
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [msgText, setMsgText] = useState("");
  const [search, setSearch] = useState("");

  const fetchRooms = useCallback(async () => {
    setFetchError(null);
    try {
      const res = await fetch(`${API_BASE}/chat/rooms`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed to load rooms");
      const j = await res.json();
      const list = j?.success ? j?.data : j;
      setRooms(list?.data ?? list ?? []);
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : "Failed to load rooms");
    } finally { setLoading(false); }
  }, []);

  const fetchMessages = useCallback(async (roomId: number) => {
    try {
      const res = await fetch(`${API_BASE}/chat/rooms/${roomId}/messages`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error();
      const j = await res.json();
      const list = j?.success ? j?.data : j;
      setMessages(list?.data ?? list ?? []);
    } catch { setMessages([]); }
  }, []);

  useEffect(() => { fetchRooms(); }, [fetchRooms]);

  const openRoom = (id: number) => { setSelected(id); fetchMessages(id); };

  const sendMessage = async () => {
    if (!msgText.trim() || !selected) return;
    try {
      await fetch(`${API_BASE}/chat/rooms/${selected}/messages`, {
        method: "POST", headers: getAuthHeaders(),
        body: JSON.stringify({ content: msgText.trim() }),
      });
      setMsgText("");
      fetchMessages(selected);
    } catch { /* ignore */ }
  };

  if (loading) return <div className="flex justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-[#38A8D8]" /></div>;

  return (
    <div className="w-full mx-auto max-w-[1200px] space-y-6 p-6 lg:p-10">
      <h1 className="text-2xl font-black tracking-tight flex items-center gap-2.5"><MessageCircle className="h-6 w-6 text-[#38A8D8]" /> Community Chat</h1>
      <p className="text-xs text-muted-foreground -mt-4">Real-time community chat rooms.</p>

      {fetchError && (
        <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-xs text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" /> {fetchError}
          <button onClick={() => { setLoading(true); fetchRooms(); }} className="ml-auto text-muted-foreground hover:text-foreground font-bold">Retry</button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search rooms..." className="pl-9 text-xs" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="rounded-xl border bg-card divide-y">
            {rooms.length === 0 && <p className="text-xs text-muted-foreground p-4 text-center">No chat rooms yet.</p>}
            {rooms.filter((r) => r.name.toLowerCase().includes(search.toLowerCase())).map((r) => (
              <button key={r.id} onClick={() => openRoom(r.id)}
                className={`w-full text-left p-3.5 hover:bg-accent/50 transition flex items-center gap-3 ${selected === r.id ? "bg-accent" : ""}`}>
                <div className="h-8 w-8 rounded-full bg-[#38A8D8]/10 flex items-center justify-center">
                  <Users className="h-4 w-4 text-[#38A8D8]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{r.name}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{r.last_message ?? "No messages yet"}</p>
                </div>
                {r.unread > 0 && <span className="text-[10px] bg-[#38A8D8] text-white rounded-full h-5 min-w-[20px] flex items-center justify-center px-1">{r.unread}</span>}
              </button>
            ))}
          </div>
        </div>

        <div className="lg:col-span-2">
          {!selected ? (
            <div className="rounded-xl border bg-card p-10 text-center text-muted-foreground">
              <MessageCircle className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Select a room</p>
              <p className="text-xs mt-1">Choose a chat room from the sidebar to start messaging.</p>
            </div>
          ) : (
            <div className="rounded-xl border bg-card flex flex-col h-[520px]">
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.length === 0 && <p className="text-xs text-muted-foreground text-center py-10">No messages yet. Send one!</p>}
                {messages.map((m) => (
                  <div key={m.id} className="space-y-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs font-semibold">{m.user.name}</span>
                      <span className="text-[10px] text-muted-foreground">{new Date(m.created_at).toLocaleTimeString()}</span>
                    </div>
                    <p className="text-sm">{m.content}</p>
                  </div>
                ))}
              </div>
              <div className="border-t p-3 flex items-center gap-2">
                <Input placeholder="Type a message..." className="text-xs" value={msgText}
                  onChange={(e) => setMsgText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendMessage()} />
                <Button size="sm" className="bg-[#38A8D8] hover:bg-[#2e8ab8] text-white px-3" onClick={sendMessage}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
