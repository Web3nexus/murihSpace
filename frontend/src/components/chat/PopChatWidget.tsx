import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation, useNavigate } from "react-router";
import {
  ChatTeardropText,
  ChatCircleDots,
  X,
  Minus,
  ArrowLeft,
  ArrowSquareOut,
  PaperPlaneRight,
  MagnifyingGlass,
  SpinnerGap,
  Users,
} from "@phosphor-icons/react";
import { useAuth } from "@/hooks/useAuth";
import { usePopChat } from "@/context/PopChatContext";
import { useRealtimeMessaging } from "@/hooks/useRealtimeMessaging";
import { apiClient } from "@/lib/api/client";
import type { ChatMessage } from "@/types/chat";
import { safeFormatDistanceToNow, safeFormat } from "@/lib/date";
import { EmojiPickerPopover } from "@/components/chat/EmojiPickerPopover";

export function PopChatWidget() {
  const { user, isAuthenticated } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const {
    isOpen,
    isMinimized,
    activeConv,
    activeRecipient,
    conversations,
    unreadCount,
    openPopChat,
    closePopChat,
    toggleMinimize,
    selectConversation,
    refreshConversations,
    backToList,
  } = usePopChat();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const onMessageReceived = useCallback((msg: ChatMessage) => {
    setMessages((prev) => {
      if (prev.some((m) => m.client_uuid && m.client_uuid === msg.client_uuid)) return prev;
      if (prev.some((m) => m.id && m.id === msg.id)) return prev;
      return [...prev, { ...msg, status: "sent" }];
    });
    refreshConversations();
  }, [refreshConversations]);

  const onTyping = useCallback(() => {}, []);
  const onReaction = useCallback(() => {}, []);

  const isFullChatPage = pathname.startsWith("/app/messages");
  const realtimeConvId = (!isAuthenticated || isFullChatPage) ? null : (activeConv?.id ?? null);

  // Real-time messaging subscription for active pop-chat conversation
  useRealtimeMessaging(realtimeConvId, user?.id, {
    onMessageReceived,
    onTyping,
    onReaction,
  });

  // Fetch messages when active conversation changes
  useEffect(() => {
    if (!activeConv || !isAuthenticated || isFullChatPage) {
      setMessages([]);
      return;
    }

    let cancelled = false;
    setLoadingMessages(true);

    apiClient
      .get<{ data: ChatMessage[] }>(`/conversations/${activeConv.id}/messages`)
      .then((res) => {
        if (cancelled) return;
        const list = Array.isArray(res.data?.data) ? res.data.data : [];
        setMessages(list);
        // Mark conversation as read
        apiClient.post(`/conversations/${activeConv.id}/read`).catch(() => {});
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingMessages(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeConv?.id]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (messagesEndRef.current && !isMinimized && isOpen) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isMinimized, isOpen]);

  // Handle user query param to boot up friend profile
  useEffect(() => {
    const search = window.location.search;
    const params = new URLSearchParams(search);
    const userId = params.get("user") ? parseInt(params.get("user") ?? "0", 10) : null;
    if (userId) {
      setSelectedUserId(userId);
    }
  }, []);

  // Select conversation based on selected user ID
  useEffect(() => {
    if (selectedUserId) {
      const conv = conversations.find(
        (c) => c.other_user && c.other_user.id === selectedUserId
      );
      if (conv) {
        selectConversation(conv);
      }
    }
  }, [selectedUserId, conversations, selectConversation]);

  // Focus input when conversation opens
  useEffect(() => {
    if (activeConv && !isMinimized && isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [activeConv, isMinimized, isOpen]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const content = inputText.trim();
    if (!content || !activeConv || sending) return;

    const clientUuid = `pop-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const optimisticMsg: ChatMessage = {
      id: 0,
      client_uuid: clientUuid,
      conversation_id: activeConv.id,
      user_id: user?.id ?? 0,
      content,
      type: "text",
      created_at: new Date().toISOString(),
      status: "pending",
      user: {
        id: user?.id ?? 0,
        name: user?.name ?? "Me",
        username: (user as any)?.username ?? "me",
        avatar_url: (user as any)?.avatar_url || (user as any)?.avatar,
      },
    };

    setMessages((prev) => [...prev, optimisticMsg]);
    setInputText("");
    setSending(true);

    try {
      const res = await apiClient.post(`/conversations/${activeConv.id}/messages`, {
        content,
        client_uuid: clientUuid,
      });
      const created = (res.data?.data as ChatMessage) ?? (res.data as ChatMessage);
      if (created?.id) {
        setMessages((prev) =>
          prev.map((m) => (m.client_uuid === clientUuid ? { ...created, status: "sent" } : m))
        );
      }
      refreshConversations();
    } catch {
      setMessages((prev) =>
        prev.map((m) => (m.client_uuid === clientUuid ? { ...m, status: "failed" } : m))
      );
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const filteredConversations = conversations.filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      c.title?.toLowerCase().includes(q) ||
      c.latest_message?.content?.toLowerCase().includes(q)
    );
  });

  // Hide popup widget if user is currently on the full /app/messages page or not authenticated
  if (!isAuthenticated || isFullChatPage) {
    return null;
  }

  // ── 1. Floating Launcher Button (Closed state) ───────────────────────────
  if (!isOpen) {
    return (
      <div className="fixed bottom-20 md:bottom-6 right-6 z-40">
        <button
          type="button"
          onClick={() => openPopChat()}
          className="relative h-14 w-14 rounded-full bg-[#2164b6] hover:bg-[#1a5091] text-white shadow-2xl flex items-center justify-center hover:scale-105 active:scale-95 transition-all cursor-pointer ring-4 ring-[#2164b6]/20"
          title="Open Messages"
          aria-label="Open Chat"
        >
          <ChatCircleDots weight="fill" className="h-7 w-7" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 min-w-5 px-1.5 rounded-full bg-rose-500 text-white font-bold text-[11px] flex items-center justify-center shadow-md ring-2 ring-background animate-pulse">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>
      </div>
    );
  }

  // ── 2. Minimized Dock Bar (Bottom Right) ─────────────────────────────────
  if (isMinimized) {
    return (
      <div className="fixed bottom-14 md:bottom-0 right-4 sm:right-10 z-50 flex items-end">
        <div
          role="button"
          tabIndex={0}
          onClick={toggleMinimize}
          className="h-11 px-4 rounded-t-2xl bg-card border border-b-0 border-border/80 shadow-2xl flex items-center gap-3 cursor-pointer hover:bg-muted/50 transition-all select-none"
        >
          <div className="relative flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-primary/10 overflow-hidden flex items-center justify-center font-bold text-xs text-primary flex-shrink-0">
              {activeRecipient?.avatar ? (
                <img src={activeRecipient.avatar} alt="" className="w-full h-full object-cover" />
              ) : (
                <ChatTeardropText weight="fill" className="h-3.5 w-3.5" />
              )}
            </div>
            <span className="text-xs font-bold text-foreground max-w-[140px] truncate">
              {activeRecipient?.name || "Chats"}
            </span>
            {unreadCount > 0 && (
              <span className="h-4 min-w-4 px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 text-muted-foreground ml-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                closePopChat();
              }}
              className="p-1 hover:text-foreground rounded-lg"
              title="Close"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── 3. Docked Floating Chat Window (Facebook Style) ───────────────────────
  return (
    <div className="fixed bottom-14 md:bottom-0 right-2 sm:right-10 z-50 w-[360px] max-w-[calc(100vw-1rem)] h-[520px] max-h-[calc(100vh-4.5rem)] rounded-t-3xl bg-card border border-b-0 border-border/80 shadow-2xl flex flex-col overflow-hidden backdrop-blur-xl animate-in slide-in-from-bottom-5 duration-200">
      {/* ── Header ── */}
      <div className="h-14 px-3.5 bg-card/90 border-b border-border/70 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          {activeConv ? (
            <>
              <button
                type="button"
                onClick={backToList}
                className="p-1.5 -ml-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-all"
                title="Back to conversations"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>

              <div className="relative flex-shrink-0">
                <div className="w-8 h-8 rounded-full bg-primary/10 overflow-hidden flex items-center justify-center font-bold text-xs text-primary">
                  {activeRecipient?.avatar ? (
                    <img src={activeRecipient.avatar} alt="" className="w-full h-full object-cover" />
                  ) : (
                    activeRecipient?.name?.charAt(0) || "C"
                  )}
                </div>
                <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-card" />
              </div>

              <div className="min-w-0">
                <h4 className="text-xs font-bold text-foreground truncate">
                  {activeRecipient?.name || activeConv.title}
                </h4>
                <p className="text-[10px] text-muted-foreground truncate">
                  {activeConv.type === "community" ? "Community Channel" : "Active now"}
                </p>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <ChatCircleDots weight="fill" className="h-4 w-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-foreground">Messages</h4>
                <p className="text-[10px] text-muted-foreground">Recent chats</p>
              </div>
            </div>
          )}
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-1 text-muted-foreground">
          {activeConv && (
            <button
              type="button"
              onClick={() => {
                closePopChat();
                navigate(`/app/messages?c=${activeConv.id}`);
              }}
              className="p-1.5 hover:text-foreground hover:bg-muted rounded-lg transition-all"
              title="Open in full screen"
            >
              <ArrowSquareOut className="h-4 w-4" />
            </button>
          )}

          <button
            type="button"
            onClick={toggleMinimize}
            className="p-1.5 hover:text-foreground hover:bg-muted rounded-lg transition-all"
            title="Minimize"
          >
            <Minus className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={closePopChat}
            className="p-1.5 hover:text-foreground hover:bg-muted rounded-lg transition-all"
            title="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ── Body: Conversation List OR Active Messages ── */}
      {activeConv ? (
        /* ── Active Conversation Stream ── */
        <div className="flex-1 flex flex-col min-h-0 bg-background/50">
          <div className="flex-1 overflow-y-auto p-3.5 space-y-2.5">
            {loadingMessages ? (
              <div className="py-16 flex flex-col items-center justify-center text-muted-foreground gap-2">
                <SpinnerGap className="h-6 w-6 animate-spin text-primary" />
                <span className="text-xs font-medium">Loading messages...</span>
              </div>
            ) : messages.length === 0 ? (
              <div className="py-16 flex flex-col items-center justify-center text-center text-muted-foreground gap-2 px-4">
                <ChatTeardropText weight="fill" className="h-10 w-10 text-muted-foreground/30" />
                <p className="text-xs font-bold text-foreground">No messages yet</p>
                <p className="text-[11px] text-muted-foreground">Send a wave to start the conversation!</p>
              </div>
            ) : (
              messages.map((msg, i) => {
                const isMe = msg.user_id === user?.id;
                return (
                  <div
                    key={msg.id || msg.client_uuid || i}
                    className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
                  >
                    <div
                      className={`max-w-[78%] px-3.5 py-2 rounded-2xl text-xs leading-relaxed shadow-2xs break-words ${
                        isMe
                          ? "bg-primary text-primary-foreground rounded-br-xs"
                          : "bg-card text-foreground border border-border/80 rounded-bl-xs"
                      }`}
                    >
                      {msg.content}
                    </div>
                    <span className="text-[9px] text-muted-foreground mt-0.5 px-1">
                      {msg.status === "pending"
                        ? "Sending..."
                        : safeFormat(msg.created_at, "h:mm a")}
                    </span>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Composer Footer */}
          <form
            onSubmit={handleSendMessage}
            className="p-2.5 bg-card border-t border-border/70 flex items-center gap-2"
          >
            <input
              ref={inputRef}
              type="text"
              placeholder={`Message ${activeRecipient?.name || ""}...`}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={sending}
              className="flex-1 h-9 px-3 text-xs rounded-xl bg-muted/60 border border-border/60 outline-none focus:ring-1 focus:ring-primary focus:bg-background transition-all"
            />
            <EmojiPickerPopover
              onSelect={(emoji) => setInputText((prev) => prev + emoji)}
              align="right"
              buttonClassName="h-9 w-9 rounded-xl"
            />
            <button
              type="submit"
              disabled={!inputText.trim() || sending}
              className="h-9 w-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40 hover:bg-primary/90 active:scale-95 transition-all flex-shrink-0"
            >
              <PaperPlaneRight weight="fill" className="h-4 w-4" />
            </button>
          </form>
        </div>
      ) : (
        /* ── Conversations List ── */
        <div className="flex-1 flex flex-col min-h-0 bg-background/50">
          {/* Search Bar */}
          <div className="p-2.5 border-b border-border/60 bg-card/60">
            <div className="relative">
              <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search chats..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-8 pl-8 pr-3 text-xs rounded-xl bg-muted/60 border-none outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
              />
            </div>
          </div>

          {/* List items */}
          <div className="flex-1 overflow-y-auto divide-y divide-border/40">
            {filteredConversations.length === 0 ? (
              <div className="py-16 text-center space-y-2 px-4">
                <Users weight="fill" className="h-8 w-8 text-muted-foreground/30 mx-auto" />
                <p className="text-xs font-bold text-foreground">No conversations found</p>
                <p className="text-[11px] text-muted-foreground">
                  Connect with friends or visit community channels.
                </p>
              </div>
            ) : (
              filteredConversations.map((c) => {
                const isUnread = (c.unread_count || 0) > 0;
                const timeStr = safeFormatDistanceToNow(c.latest_message?.created_at, { addSuffix: false });

                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => selectConversation(c)}
                    className="w-full p-3 flex items-center gap-3 text-left hover:bg-muted/50 transition-colors cursor-pointer group"
                  >
                    <div className="relative flex-shrink-0">
                      <div className="w-10 h-10 rounded-full bg-primary/10 overflow-hidden flex items-center justify-center font-bold text-xs text-primary">
                        {(c.other_user?.avatar_url || c.community?.logo_url || (c as any).avatar_url) ? (
                          <img src={c.other_user?.avatar_url || c.community?.logo_url || (c as any).avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          c.title?.charAt(0) || "C"
                        )}
                      </div>
                      {isUnread && (
                        <span className="absolute top-0 right-0 h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-card" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <span className={`text-xs truncate ${isUnread ? "font-bold text-foreground" : "font-medium text-foreground/90"}`}>
                          {c.title}
                        </span>
                        {timeStr && (
                          <span className="text-[10px] text-muted-foreground/70 flex-shrink-0">
                            {timeStr}
                          </span>
                        )}
                      </div>
                      <p className={`text-[11px] truncate ${isUnread ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                        {c.latest_message?.content || "No messages yet"}
                      </p>
                    </div>

                    {isUnread && (
                      <span className="h-4 min-w-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                        {c.unread_count}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* Footer to open full messages page */}
          <div className="p-2 border-t border-border/60 bg-card flex justify-center">
            <button
              type="button"
              onClick={() => {
                closePopChat();
                navigate("/app/messages");
              }}
              className="text-xs font-semibold text-primary hover:underline flex items-center gap-1.5 py-1"
            >
              <span>See all in MurihSpace Inbox</span>
              <ArrowSquareOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
