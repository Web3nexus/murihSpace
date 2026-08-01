import { useState, useEffect, useCallback, useRef } from "react";
import {
  MessageCircle, Search, Send, Loader2, ArrowLeft,
  AlertCircle, RotateCcw, Reply, Paperclip, CheckCheck, BellOff, MoreVertical, Hash,
  FileText, Volume2,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import type { ConversationItem, ChatMessage, MessageStatus, MessageReaction } from "@/types/chat";
import { ReplyPreviewBar } from "@/components/chat/ReplyPreviewBar";
import { MessageReactions } from "@/components/chat/MessageReactions";
import { useRealtimeMessaging } from "@/hooks/useRealtimeMessaging";
import { cn } from "@/lib/utils";
import { getAuthToken } from "@/lib/auth/token";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000/api/v1";

function getToken(): string | null {
  return getAuthToken();
}

function getUserData(): Record<string, unknown> {
  try {
    return JSON.parse(localStorage.getItem("user_data") ?? "{}");
  } catch {
    return {};
  }
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message ?? `HTTP ${res.status}`);
  }
  return res.json();
}

function CommunityAvatar({ name, logo_url }: { name: string; logo_url?: string }) {
  const initial = name.charAt(0).toUpperCase();
  if (logo_url) {
    return (
      <img
        src={logo_url}
        alt={name}
        className="h-9 w-9 rounded-xl object-cover shrink-0 shadow-xs"
      />
    );
  }
  return (
    <div className="h-9 w-9 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-xs bg-gradient-to-br from-[#38A8D8] to-[#2563eb]">
      {initial}
    </div>
  );
}

function UserAvatar({ name, size = 28 }: { name?: string; size?: number }) {
  const initials = name
    ? name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : "?";
  return (
    <div
      className="flex items-center justify-center rounded-full bg-gradient-to-br from-[#38A8D8] to-[#1a6b9e] text-white font-bold shrink-0 shadow-xs"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {initials}
    </div>
  );
}

export default function CommunityChatPage() {
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [activeConv, setActiveConv] = useState<ConversationItem | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [isLoadingMsgs, setIsLoadingMsgs] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [inputContent, setInputContent] = useState("");
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const currentUserData = getUserData();
  const currentUserId = (currentUserData?.id as number | undefined) ?? undefined;

  const onMessageReceived = useCallback((msg: ChatMessage) => {
    setMessages((prev) => {
      if (prev.some((m) => m.client_uuid && m.client_uuid === msg.client_uuid)) return prev;
      if (prev.some((m) => m.id && m.id === msg.id)) return prev;
      return [...prev, { ...msg, status: "sent" as MessageStatus }];
    });
    setConversations((prev) => prev.map((c) =>
      c.id === msg.conversation_id
        ? { ...c, latest_message: msg, updated_at: msg.created_at, unread_count: c.id === activeConv?.id ? 0 : (c.unread_count ?? 0) + 1 }
        : c,
    ));
  }, [activeConv?.id]);

  const onTyping = useCallback((data: { user_id: number; user_name: string; is_typing: boolean }) => {
    if (data.is_typing) {
      setTypingUsers((prev) => prev.includes(data.user_name) ? prev : [...prev, data.user_name]);
    } else {
      setTypingUsers((prev) => prev.filter((n) => n !== data.user_name));
    }
  }, []);

  const onReaction = useCallback((data: { message_id: number; reactions: MessageReaction[] }) => {
    setMessages((prev) => prev.map((m) =>
      m.id === data.message_id ? { ...m, reactions: data.reactions } : m,
    ));
  }, []);

  useRealtimeMessaging(activeConv?.id ?? null, currentUserId, {
    onMessageReceived,
    onTyping,
    onReaction,
  });

  const loadConversations = useCallback(async () => {
    setListError(null);
    try {
      const res = await apiFetch<{ data: ConversationItem[] }>("/conversations");
      const list = Array.isArray(res.data) ? res.data : [];
      setConversations(list.filter((c) => c.type === "community"));
    } catch (e) {
      setListError(e instanceof Error ? e.message : "Failed to load communities");
    } finally {
      setIsLoadingList(false);
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadConvSettings = async (convId: number) => {
    try {
      const res = await apiFetch<{ data: { is_muted: boolean } }>(`/conversations/${convId}/settings`);
      setIsMuted(res.data?.is_muted ?? false);
    } catch { /* ignore */ }
  };

  const selectConversation = async (conv: ConversationItem) => {
    setActiveConv(conv);
    setReplyingTo(null);
    setIsLoadingMsgs(true);
    setTypingUsers([]);

    try {
      const res = await apiFetch<{ data: ChatMessage[] }>(`/conversations/${conv.id}/messages`);
      const list = res && "data" in res ? res.data : Array.isArray(res) ? res : [];
      setMessages((Array.isArray(list) ? list : []).map((m) => ({ ...m, status: "sent" as MessageStatus })));

      if (conv.unread_count > 0) {
        await apiFetch(`/conversations/${conv.id}/read`, { method: "POST" });
        setConversations((prev) => prev.map((c) => (c.id === conv.id ? { ...c, unread_count: 0 } : c)));
      }
    } catch {
      setMessages([]);
    } finally {
      setIsLoadingMsgs(false);
    }

    loadConvSettings(conv.id);
  };

  const executeSendMessage = async (msg: ChatMessage) => {
    if (!activeConv) return;
    setMessages((prev) => prev.map((m) => m.client_uuid === msg.client_uuid ? { ...m, status: "pending" as MessageStatus } : m));
    try {
      const res = await apiFetch<{ data: ChatMessage } | ChatMessage>(`/conversations/${activeConv.id}/messages`, {
        method: "POST",
        body: JSON.stringify({
          content: msg.content,
          client_uuid: msg.client_uuid,
          reply_to_id: msg.reply_to_id ?? null,
          attachment_url: msg.attachment_url ?? null,
          attachment_type: msg.attachment_type ?? null,
        }),
      });
      const serverMsg = "data" in res ? res.data : res;
      setMessages((prev) => prev.map((m) => m.client_uuid === msg.client_uuid ? { ...serverMsg, status: "sent" as MessageStatus, client_uuid: msg.client_uuid } : m));
      setConversations((prev) => prev.map((c) => c.id === activeConv.id ? { ...c, latest_message: serverMsg, updated_at: serverMsg.created_at } : c));
    } catch {
      setMessages((prev) => prev.map((m) => m.client_uuid === msg.client_uuid ? { ...m, status: "failed" as MessageStatus } : m));
    }
  };

  const handleTypingDebounced = async () => {
    if (!activeConv) return;
    try {
      await apiFetch(`/conversations/${activeConv.id}/typing`, { method: "POST", body: JSON.stringify({ is_typing: true }) });
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(async () => {
        try { await apiFetch(`/conversations/${activeConv.id}/typing`, { method: "POST", body: JSON.stringify({ is_typing: false }) }); } catch { /* ignore */ }
      }, 2500);
    } catch { /* ignore */ }
  };

  const handleSendMessage = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!activeConv || !inputContent.trim()) return;
    const contentText = inputContent.trim();
    setInputContent("");
    const clientUuid = crypto.randomUUID ? crypto.randomUUID() : `uuid-${Date.now()}`;

    const draft: ChatMessage = {
      conversation_id: activeConv.id,
      user_id: currentUserId ?? 0,
      content: contentText,
      type: "text",
      client_uuid: clientUuid,
      status: "pending",
      reply_to_id: replyingTo?.id ?? undefined,
      reply_to: replyingTo ? { id: replyingTo.id!, user_id: replyingTo.user_id, content: replyingTo.content } : undefined,
      created_at: new Date().toISOString(),
      user: { id: currentUserId ?? 0, name: (currentUserData?.name as string) ?? "You", username: (currentUserData?.username as string) ?? "you" },
    };

    setReplyingTo(null);
    setMessages((prev) => [...prev, draft]);
    executeSendMessage(draft);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeConv) return;
    e.target.value = "";

    setUploading(true);
    try {
      const token = getToken();
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`${API_BASE}/messages/attachments`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: formData,
      });

      if (!res.ok) throw new Error("Upload failed");
      const json = await res.json();
      const { attachment_url, attachment_type } = json.data;

      const clientUuid = crypto.randomUUID ? crypto.randomUUID() : `uuid-${Date.now()}`;
      const draft: ChatMessage = {
        conversation_id: activeConv.id,
        user_id: currentUserId ?? 0,
        content: "",
        type: attachment_type as ChatMessage["type"],
        client_uuid: clientUuid,
        status: "pending" as MessageStatus,
        attachment_url,
        attachment_type: attachment_type as ChatMessage["attachment_type"],
        created_at: new Date().toISOString(),
        user: { id: currentUserId ?? 0, name: (currentUserData?.name as string) ?? "You", username: (currentUserData?.username as string) ?? "you" },
      };

      setMessages((prev) => [...prev, draft]);
      executeSendMessage(draft);
    } catch (err) {
      console.error("Failed to upload file", err);
    } finally {
      setUploading(false);
    }
  };

  const handleToggleMute = async () => {
    if (!activeConv) return;
    try {
      await apiFetch(`/conversations/${activeConv.id}/settings`, { method: "PUT", body: JSON.stringify({ is_muted: !isMuted }) });
      setIsMuted(!isMuted);
    } catch { /* ignore */ }
    setShowHeaderMenu(false);
  };

  const handleReactionToggle = (messageId: number, updated: MessageReaction[]) => {
    setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, reactions: updated } : m)));
  };

  const filteredConversations = conversations.filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return c.title.toLowerCase().includes(q) || c.latest_message?.content?.toLowerCase().includes(q);
  });

  if (isLoadingList) {
    return (
      <div className="flex h-[calc(100svh-112px)] items-center justify-center">
        <div className="text-center space-y-3">
          <div className="relative mx-auto h-12 w-12">
            <Loader2 className="h-12 w-12 animate-spin text-[#38A8D8]" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">Loading community chat...</p>
        </div>
      </div>
    );
  }

  if (listError) {
    return (
      <div className="flex h-[calc(100svh-112px)] items-center justify-center p-6">
        <div className="max-w-sm text-center space-y-4">
          <div className="mx-auto rounded-2xl bg-destructive/10 p-4 w-fit">
            <AlertCircle className="h-8 w-8 text-destructive" />
          </div>
          <h3 className="text-base font-bold text-foreground">Failed to Load</h3>
          <p className="text-xs text-muted-foreground">{listError}</p>
          <button
            onClick={() => { setIsLoadingList(true); loadConversations(); }}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#38A8D8] hover:underline"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Try again
          </button>
        </div>
      </div>
    );
  }

  if (conversations.length === 0 && !activeConv) {
    return (
      <div className="flex h-[calc(100svh-112px)] items-center justify-center p-6">
        <div className="max-w-sm text-center space-y-4">
          <div className="mx-auto rounded-2xl bg-[#38A8D8]/10 p-4 w-fit">
            <MessageCircle className="h-8 w-8 text-[#38A8D8]" />
          </div>
          <h3 className="text-base font-bold text-foreground">No Community Chats</h3>
          <p className="text-xs text-muted-foreground">
            Join a community to start chatting with members in real-time.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] w-full overflow-hidden bg-background">
      {/* Sidebar */}
      <aside className={`${activeConv ? "hidden md:flex" : "flex"} w-full md:w-[320px] shrink-0 flex-col border-r border-border bg-card`}>
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-lg bg-[#38A8D8]/15 flex items-center justify-center">
              <Hash className="h-3.5 w-3.5 text-[#38A8D8]" />
            </div>
            <h2 className="text-sm font-extrabold text-foreground tracking-tight">Community Chat</h2>
          </div>
          <span className="text-[10px] font-semibold text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-full">
            {conversations.length}
          </span>
        </div>

        <div className="px-3 py-2.5 border-b border-border">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search channels..."
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg bg-muted border-0 outline-none focus:ring-1 focus:ring-[#38A8D8] placeholder:text-muted-foreground"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-border/30">
          {filteredConversations.length === 0 ? (
            <div className="p-6 text-center space-y-2">
              <Hash className="h-6 w-6 text-muted-foreground/30 mx-auto" />
              <p className="text-xs font-medium text-muted-foreground">No channels found</p>
            </div>
          ) : filteredConversations.map((c) => {
            const isSelected = activeConv?.id === c.id;
            const timeFormatted = c.latest_message
              ? formatDistanceToNow(new Date(c.latest_message.created_at), { addSuffix: false })
              : "";
            const communityName = c.community?.name ?? c.title;
            const logoUrl = c.community?.logo_url;

            return (
              <button
                key={c.id}
                onClick={() => selectConversation(c)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 text-left transition-all duration-150",
                  isSelected
                    ? "bg-[#38A8D8]/10 border-l-[3px] border-[#38A8D8]"
                    : "hover:bg-muted/40 border-l-[3px] border-transparent",
                )}
              >
                <CommunityAvatar name={communityName} logo_url={logoUrl} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-foreground truncate flex items-center gap-1.5">
                      {c.is_muted && <BellOff className="h-3 w-3 text-muted-foreground shrink-0" />}
                      {communityName}
                    </span>
                    {timeFormatted && (
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {timeFormatted}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground/80 truncate mt-0.5">
                    {c.latest_message
                      ? c.latest_message.content
                      : "No messages yet"}
                  </p>
                </div>
                {c.unread_count > 0 && (
                  <span className="h-4 min-w-[18px] px-1 rounded-full bg-[#38A8D8] text-white text-[10px] font-extrabold flex items-center justify-center shrink-0 shadow-xs">
                    {c.unread_count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </aside>

      {/* Main Chat Area */}
      <main className={`${activeConv ? "flex" : "hidden md:flex"} flex-1 flex-col bg-background`}>
        {activeConv ? (
          <>
            {/* Header */}
            <div className="px-4 py-3 border-b border-border bg-card flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <button
                  onClick={() => setActiveConv(null)}
                  className="md:hidden p-1.5 rounded-lg hover:bg-muted text-muted-foreground shrink-0"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <CommunityAvatar
                  name={activeConv.community?.name ?? activeConv.title}
                  logo_url={activeConv.community?.logo_url}
                />
                <div className="min-w-0">
                  <h3 className="text-sm font-extrabold text-foreground truncate flex items-center gap-1.5">
                    {isMuted && <BellOff className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                    {activeConv.community?.name ?? activeConv.title}
                  </h3>
                  <p className="text-[10px] text-muted-foreground/70 flex items-center gap-1">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    {activeConv.community?.name ? `${Math.floor(Math.random() * 15 + 1)} online` : "Community channel"}
                  </p>
                </div>
              </div>

              <div className="relative">
                <button
                  onClick={() => setShowHeaderMenu((v) => !v)}
                  className="p-1.5 rounded-lg hover:bg-muted/70 text-muted-foreground transition-colors"
                >
                  <MoreVertical className="h-4 w-4" />
                </button>
                {showHeaderMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowHeaderMenu(false)} />
                    <div className="absolute right-0 top-8 z-50 w-44 rounded-xl border border-border bg-card shadow-xl p-1 text-xs space-y-0.5">
                      <button
                        onClick={handleToggleMute}
                        className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-muted text-foreground font-medium"
                      >
                        <BellOff className="h-3.5 w-3.5 text-muted-foreground" />
                        {isMuted ? "Unmute channel" : "Mute channel"}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Message Stream */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1 bg-[#F8FAFB] dark:bg-[#0a1a2a]/60">
              {isLoadingMsgs ? (
                <div className="py-20 text-center space-y-2">
                  <Loader2 className="h-5 w-5 animate-spin text-[#38A8D8] mx-auto" />
                  <p className="text-xs text-muted-foreground font-medium">Loading messages...</p>
                </div>
              ) : messages.length === 0 ? (
                <div className="py-20 text-center space-y-2">
                  <div className="mx-auto w-10 h-10 rounded-xl bg-[#38A8D8]/10 flex items-center justify-center">
                    <MessageCircle className="h-5 w-5 text-[#38A8D8]" />
                  </div>
                  <p className="text-sm font-bold text-foreground">Start the conversation</p>
                  <p className="text-xs text-muted-foreground max-w-[200px] mx-auto">
                    Be the first to send a message in {activeConv.community?.name ?? activeConv.title}
                  </p>
                </div>
              ) : (
                messages.map((msg, idx) => {
                  const isMine = msg.user_id === currentUserId;
                  const isPending = msg.status === "pending";
                  const isFailed = msg.status === "failed";
                  const showAvatar = idx === 0 || messages[idx - 1]?.user_id !== msg.user_id;

                  return (
                    <div
                      key={msg.client_uuid || msg.id}
                      className={cn(
                        "flex items-end gap-2 px-2 group",
                        isMine ? "justify-end" : "justify-start",
                      )}
                    >
                      {!isMine && showAvatar && (
                        <UserAvatar name={msg.user?.name} size={28} />
                      )}
                      {!isMine && !showAvatar && (
                        <div className="w-[28px] shrink-0" />
                      )}

                      <div className={cn(
                        "max-w-[70%] sm:max-w-[60%] space-y-0.5",
                        isMine ? "items-end" : "items-start",
                      )}>
                        {msg.reply_to && (
                          <div className={cn(
                            "px-2.5 py-1.5 rounded-xl text-[11px] border-l-[3px] border-[#38A8D8] bg-[#38A8D8]/8 text-muted-foreground",
                            isMine ? "ml-auto" : "",
                          )}>
                            <span className="font-bold text-[#38A8D8] text-[10px]">
                              {msg.reply_to.user?.name ?? "User"}
                            </span>
                            <p className="truncate mt-0.5">{msg.reply_to.content?.slice(0, 60)}</p>
                          </div>
                        )}

                        <div
                          className={cn(
                            "p-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words",
                            isMine
                              ? isFailed
                                ? "bg-destructive/10 border border-destructive/30 text-foreground rounded-br-md"
                                : isPending
                                  ? "bg-[#38A8D8]/70 text-white rounded-br-md opacity-85"
                                  : "bg-[#38A8D8] text-white rounded-br-md shadow-sm"
                              : "bg-white dark:bg-[#102840] border border-border/60 text-foreground rounded-bl-md shadow-sm",
                          )}
                        >
                          {!isMine && msg.user?.name && showAvatar && (
                            <span className="block text-[10px] font-bold text-[#38A8D8] mb-1">
                              {msg.user.name}
                            </span>
                          )}

                          {msg.attachment_url && (
                            <div className="mb-1.5">
                              {msg.attachment_type === "image" ? (
                                <img
                                  src={msg.attachment_url}
                                  alt="attachment"
                                  className="max-w-full rounded-xl max-h-48 object-cover"
                                />
                              ) : (
                                <a
                                  href={msg.attachment_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="flex items-center gap-2 text-xs font-semibold underline"
                                >
                                  {msg.attachment_type === "voice" ? (
                                    <Volume2 className="h-3.5 w-3.5" />
                                  ) : (
                                    <FileText className="h-3.5 w-3.5" />
                                  )}
                                  Attachment
                                </a>
                              )}
                            </div>
                          )}

                          <p className="text-inherit">{msg.content}</p>

                          <div className={cn(
                            "flex items-center justify-end gap-1 mt-1",
                            isMine ? "text-white/70" : "text-muted-foreground/60",
                          )}>
                            <span className="text-[10px]">
                              {format(new Date(msg.created_at), "h:mm a")}
                            </span>
                            {isMine && (
                              isPending ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : isFailed ? (
                                <AlertCircle className="h-3 w-3 text-destructive" />
                              ) : (
                                <CheckCheck className="h-3 w-3" />
                              )
                            )}
                          </div>

                          {isFailed && (
                            <button
                              onClick={() => executeSendMessage(msg)}
                              className="mt-1.5 flex items-center gap-1 text-[11px] font-bold text-destructive hover:underline"
                            >
                              <RotateCcw className="h-3 w-3" /> Retry
                            </button>
                          )}
                        </div>

                        {msg.id && (
                          <div className={cn("px-1 pt-0.5", isMine ? "flex justify-end" : "")}>
                            <MessageReactions
                              messageId={msg.id}
                              reactions={msg.reactions ?? []}
                              onReactionToggle={handleReactionToggle}
                            />
                          </div>
                        )}
                      </div>

                      <button
                        onClick={() => setReplyingTo(msg)}
                        className="opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground shrink-0 mb-1"
                        title="Reply"
                      >
                        <Reply className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })
              )}

              {typingUsers.length > 0 && (
                <div className="flex items-center gap-2.5 px-3 py-1">
                  <div className="flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        className="h-2 w-2 rounded-full bg-[#38A8D8] animate-bounce"
                        style={{ animationDelay: `${i * 200}ms` }}
                      />
                    ))}
                  </div>
                  <span className="text-[11px] text-muted-foreground italic">
                    {typingUsers.join(", ")} {typingUsers.length === 1 ? "is" : "are"} typing...
                  </span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {replyingTo && (
              <ReplyPreviewBar
                replyingTo={replyingTo}
                onDismiss={() => setReplyingTo(null)}
              />
            )}

            <form
              onSubmit={handleSendMessage}
              className="p-3 border-t border-border bg-card flex items-center gap-2 shrink-0"
            >
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0 disabled:opacity-50"
                title="Attach file"
              >
                {uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Paperclip className="h-4 w-4" />
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.pdf,.doc,.docx,.txt,.mp3,.mp4,.mov,.zip,.csv,.xlsx,.pptx"
                className="hidden"
                onChange={handleFileUpload}
              />

              <input
                type="text"
                value={inputContent}
                onChange={(e) => { setInputContent(e.target.value); handleTypingDebounced(); }}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) handleSendMessage(); }}
                placeholder={`Message #${activeConv.community?.name ?? activeConv.title}...`}
                className="flex-1 px-4 py-2.5 text-sm rounded-xl bg-muted/60 border border-border/50 outline-none focus:ring-1 focus:ring-[#38A8D8]/40 focus:border-[#38A8D8] placeholder:text-muted-foreground/60 transition-all"
              />

              <button
                type="submit"
                disabled={!inputContent.trim() || uploading}
                className="p-2.5 rounded-xl bg-[#38A8D8] text-white font-bold hover:bg-[#2e8ab8] disabled:opacity-40 transition-all shrink-0 shadow-xs"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center px-6">
            <div className="rounded-2xl bg-[#38A8D8]/10 p-5 border border-[#38A8D8]/20">
              <Hash className="h-10 w-10 text-[#38A8D8]" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-extrabold text-foreground">Community Chat</h3>
              <p className="text-xs text-muted-foreground max-w-sm">
                Select a community channel to start chatting with members.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
