import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation, useNavigate } from "react-router";
import {
  ChatTeardropText,
  X,
  Minus,
  ArrowLeft,
  ArrowSquareOut,
  PaperPlaneRight,
  SpinnerGap,
  Checks as CheckCheck,
  Check as CheckIcon,
  Phone,
  VideoCamera,
} from "@phosphor-icons/react";
import { useAuth } from "@/hooks/useAuth";
import { usePopChat } from "@/context/PopChatContext";
import { useRealtimeMessaging } from "@/hooks/useRealtimeMessaging";
import { apiClient } from "@/lib/api/client";
import { extractMessages } from "@/lib/chatMessages";
import type { ChatMessage } from "@/types/chat";
import { safeFormat } from "@/lib/date";
import { EmojiPickerPopover } from "@/components/chat/EmojiPickerPopover";
import { playMessageReceivedSound } from "@/lib/sound";

export function formatMessagePreview(msg?: { content?: string; type?: string; attachment_type?: string } | null): string {
  if (!msg || !msg.content) return "No messages yet";
  const content = typeof msg.content === "string" ? msg.content.trim() : "";
  const isCall =
    msg.type === "call" ||
    msg.attachment_type === "call" ||
    content.startsWith('{"call_id"') ||
    (content.startsWith("{") && content.includes('"call_id"'));

  if (isCall) {
    try {
      const d = JSON.parse(content);
      const isVideo = d.call_type === "video";
      const isMissed = d.status === "missed" || d.status === "declined";
      const dur = Number(d.duration) || 0;
      if (isMissed) {
        return isVideo ? "📹 Missed Video Call" : "📞 Missed Call";
      }
      if (dur > 0) {
        const m = Math.floor(dur / 60);
        const s = dur % 60;
        const ds = m > 0 ? `${m}m ${s}s` : `${s}s`;
        return isVideo ? `📹 Video Call · ${ds}` : `📞 Voice Call · ${ds}`;
      }
      return isVideo ? "📹 Video Call" : "📞 Voice Call";
    } catch {
      return "📞 Call";
    }
  }

  if (msg.attachment_type === "image" || msg.type === "image") return "📷 Photo";
  if (msg.attachment_type === "video" || msg.type === "video") return "🎬 Video";
  if (msg.attachment_type === "voice" || msg.type === "voice") return "🎤 Voice message";
  if (msg.attachment_type === "file" || msg.type === "file") return "📎 File";

  return msg.content;
}

export function PopChatWidget() {
  const { user, isAuthenticated } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const {
    isOpen,
    isMinimized,
    activeConv,
    activeRecipient,
    closePopChat,
    toggleMinimize,
    refreshConversations,
  } = usePopChat();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const onMessageReceived = useCallback((msg: ChatMessage) => {
    playMessageReceivedSound();
    setMessages((prev) => {
      if (prev.some((m) => m.client_uuid && m.client_uuid === msg.client_uuid)) return prev;
      if (prev.some((m) => m.id && m.id === msg.id)) return prev;
      return [...prev, { ...msg, status: "sent" }];
    });
    if (activeConv?.id === msg.conversation_id) {
      apiClient.post(`/conversations/${msg.conversation_id}/read`).catch(() => {});
      if (msg.id) {
        apiClient.post(`/conversations/${msg.conversation_id}/delivered`, {
          message_ids: [msg.id],
        }).catch(() => {});
      }
    }
    refreshConversations();
  }, [activeConv?.id, refreshConversations]);

  const onMessageRead = useCallback((data: { conversation_id: number; reader_id: number }) => {
    if (data.reader_id !== user?.id) {
      setMessages((prev) =>
        prev.map((m) =>
          m.user_id === user?.id && m.status !== "read" ? { ...m, status: "read" } : m,
        ),
      );
    }
  }, [user?.id]);

  const onMessageDelivered = useCallback((data: { conversation_id: number; message_ids: number[] }) => {
    const ids = new Set(data.message_ids);
    setMessages((prev) =>
      prev.map((m) =>
        m.id !== undefined && ids.has(m.id) && m.status === "sent" ? { ...m, status: "delivered" } : m,
      ),
    );
  }, []);

  const onTyping = useCallback(() => {}, []);
  const onReaction = useCallback(() => {}, []);

  // Suppress realtime on chat page or if not open
  const isOnChatPage = pathname.startsWith("/app/messages");
  const isAdminPage = pathname.startsWith("/app/securegate");
  const realtimeConvId = (!isAuthenticated || isOnChatPage || isAdminPage || !isOpen) ? null : (activeConv?.id ?? null);

  useRealtimeMessaging(realtimeConvId, user?.id, {
    onMessageReceived,
    onTyping,
    onReaction,
    onMessageRead,
    onMessageDelivered,
  });

  // Fetch messages when active conversation changes
  useEffect(() => {
    if (!activeConv || !isAuthenticated || isOnChatPage) {
      setMessages([]);
      return;
    }

    let cancelled = false;
    setLoadingMessages(true);

    apiClient
      .get(`/conversations/${activeConv.id}/messages`)
      .then((res) => {
        if (cancelled) return;
        const list = extractMessages(res.data);
        const formatted = list.map((m: any) => ({
          ...m,
          status: m.read === true ? "read" : (m.status && m.status !== "sent" ? m.status : "sent"),
        }));
        setMessages(formatted);
        apiClient.post(`/conversations/${activeConv.id}/read`).catch(() => {});
        import("@/lib/chatUnread").then(({ getUnreadCount, setUnreadCount, refreshUnreadCount }) => {
          const conv = activeConv as any;
          const unread = conv?.unread_count ?? 0;
          if (unread > 0) setUnreadCount(Math.max(0, getUnreadCount() - unread));
          refreshUnreadCount().catch(() => {});
        });
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

  // Focus input when conversation opens / unminimizes
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
          prev.map((m) => (m.client_uuid === clientUuid ? { ...created, status: "sent" } : m)),
        );
      }
      refreshConversations();
    } catch {
      setMessages((prev) =>
        prev.map((m) => (m.client_uuid === clientUuid ? { ...m, status: "failed" } : m)),
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

  // ── Visibility rules ──────────────────────────────────────────────────────
  // 1. Must be authenticated
  // 2. Must NOT be on the full chat / messages page (user already has full UI there)
  // 3. Must NOT be on admin pages (securegate)
  // 4. Must be explicitly opened (isOpen) — no permanent floating button
  // 5. Must have an active conversation selected (no generic chat list pop-in)
  if (
    !isAuthenticated ||
    isOnChatPage ||
    isAdminPage ||
    !isOpen ||
    !activeConv
  ) {
    return null;
  }

  // ── Minimized: Facebook-style square tab docked at bottom-right ───────────
  if (isMinimized) {
    return (
      <div className="fixed bottom-14 md:bottom-0 right-4 sm:right-10 z-50 flex items-end">
        <div
          role="button"
          tabIndex={0}
          onClick={toggleMinimize}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && toggleMinimize()}
          className="h-12 px-3.5 rounded-t-xl bg-card border border-b-0 border-border/80 shadow-2xl flex items-center gap-2.5 cursor-pointer hover:bg-muted/50 transition-all select-none min-w-[180px] max-w-[260px]"
        >
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            <div className="w-7 h-7 rounded-md bg-primary/10 overflow-hidden flex items-center justify-center font-bold text-xs text-primary">
              {activeRecipient?.avatar ? (
                <img src={activeRecipient.avatar} alt="" className="w-full h-full object-cover" />
              ) : (
                activeRecipient?.name?.charAt(0) || <ChatTeardropText weight="fill" className="h-3.5 w-3.5" />
              )}
            </div>
            {activeRecipient?.is_online && (
              <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-[#34C759] ring-1 ring-card" />
            )}
          </div>

          <span className="text-xs font-bold text-foreground truncate flex-1">
            {activeRecipient?.name || "Chat"}
          </span>

          <div className="flex items-center gap-0.5 text-muted-foreground ml-1">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                closePopChat();
              }}
              className="p-1 hover:text-foreground rounded-md hover:bg-muted/60 transition-colors"
              title="Close"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Expanded: square-cornered Facebook Messenger-style chat window ─────────
  return (
    <div className="fixed bottom-14 md:bottom-0 right-2 sm:right-10 z-50 w-[340px] max-w-[calc(100vw-1rem)] h-[480px] max-h-[calc(100vh-4.5rem)] rounded-t-xl bg-card border border-b-0 border-border/80 shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-200">

      {/* ── Header (square, not rounded) ── */}
      <div className="h-12 px-3 bg-[#2164b6] flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={closePopChat}
            className="p-1 -ml-1 text-white/70 hover:text-white hover:bg-white/10 rounded-md transition-all"
            title="Close chat"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>

          <div className="relative flex-shrink-0">
            <div className="w-7 h-7 rounded-md bg-white/20 overflow-hidden flex items-center justify-center font-bold text-xs text-white">
              {activeRecipient?.avatar ? (
                <img src={activeRecipient.avatar} alt="" className="w-full h-full object-cover" />
              ) : (
                activeRecipient?.name?.charAt(0) || "C"
              )}
            </div>
            {activeRecipient?.is_online && (
              <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-[#34C759] ring-1 ring-[#2164b6] shadow-xs" />
            )}
          </div>

          <div className="min-w-0">
            <h4 className="text-xs font-bold text-white truncate">
              {activeRecipient?.name || activeConv.title}
            </h4>
            <p className="text-[10px] truncate text-white/70">
              {activeConv.type === "community" ? "Community Channel" : (
                activeRecipient?.is_online ? (
                  <span className="text-[#4ade80] font-semibold">Active now</span>
                ) : (
                  <span>{activeRecipient?.last_seen || "offline"}</span>
                )
              )}
            </p>
          </div>
        </div>

        {/* Header actions */}
        <div className="flex items-center gap-0.5 text-white/70">
          <button
            type="button"
            onClick={() => {
              closePopChat();
              navigate(`/app/messages?c=${activeConv.id}`);
            }}
            className="p-1.5 hover:text-white hover:bg-white/10 rounded-md transition-all"
            title="Open full screen"
          >
            <ArrowSquareOut className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={toggleMinimize}
            className="p-1.5 hover:text-white hover:bg-white/10 rounded-md transition-all"
            title="Minimize"
          >
            <Minus className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={closePopChat}
            className="p-1.5 hover:text-white hover:bg-white/10 rounded-md transition-all"
            title="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ── Message stream ── */}
      <div className="flex-1 flex flex-col min-h-0 bg-background/50">
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {loadingMessages ? (
            <div className="py-16 flex flex-col items-center justify-center text-muted-foreground gap-2">
              <SpinnerGap className="h-6 w-6 animate-spin text-primary" />
              <span className="text-xs font-medium">Loading messages...</span>
            </div>
          ) : messages.length === 0 ? (
            <div className="py-16 flex flex-col items-center justify-center text-center text-muted-foreground gap-2 px-4">
              <ChatTeardropText weight="fill" className="h-10 w-10 text-muted-foreground/30" />
              <p className="text-xs font-bold text-foreground">No messages yet</p>
              <p className="text-[11px] text-muted-foreground">Say hi to start the conversation!</p>
            </div>
          ) : (
            messages.map((msg, i) => {
              const isMe = msg.user_id === user?.id;
              const content = typeof msg.content === "string" ? msg.content.trim() : "";
              const isCall =
                msg.type === "call" ||
                msg.attachment_type === "call" ||
                content.startsWith('{"call_id"') ||
                (content.startsWith("{") && content.includes('"call_id"'));

              let callData: any = null;
              if (isCall) {
                try {
                  callData = JSON.parse(content);
                } catch {
                  callData = { status: "ended", call_type: "audio", duration: 0 };
                }
              }

              const isVideo = callData?.call_type === "video";
              const isMissed = callData?.status === "missed" || callData?.status === "declined";
              const dur = Number(callData?.duration) || 0;
              const durStr =
                dur > 0
                  ? `${Math.floor(dur / 60)}m ${dur % 60}s`
                  : isMissed
                  ? callData?.status === "declined"
                    ? "Call declined"
                    : "Missed call"
                  : "Call ended";

              return (
                <div
                  key={msg.id || msg.client_uuid || i}
                  className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
                >
                  <div
                    className={`max-w-[85%] px-3 py-2 rounded-2xl text-xs leading-relaxed shadow-2xs break-words ${
                      isCall
                        ? isMissed
                          ? "bg-red-500/10 text-red-400 border border-red-500/20"
                          : "bg-card text-foreground border border-border/80"
                        : isMe
                        ? "bg-[#2164b6] text-white rounded-br-sm"
                        : "bg-card text-foreground border border-border/70 rounded-bl-sm"
                    }`}
                  >
                    {isCall ? (
                      <div className="flex items-center gap-2.5 py-0.5 min-w-[150px]">
                        <div
                          className={`p-2 rounded-full shrink-0 ${
                            isMissed ? "bg-red-500/20 text-red-500" : "bg-emerald-500/20 text-emerald-400"
                          }`}
                        >
                          {isVideo ? (
                            <VideoCamera weight="fill" className="h-4 w-4" />
                          ) : (
                            <Phone weight="fill" className="h-4 w-4" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`font-semibold text-xs truncate ${isMissed ? "text-red-400" : "text-foreground"}`}>
                            {isMissed
                              ? isVideo
                                ? "Missed Video Call"
                                : "Missed Voice Call"
                              : isVideo
                              ? "Video Call"
                              : "Voice Call"}
                          </p>
                          <p className="text-[10px] text-muted-foreground">{durStr}</p>
                        </div>
                      </div>
                    ) : (
                      msg.content
                    )}
                  </div>
                  <span className="text-[9px] text-muted-foreground mt-0.5 px-1 flex items-center gap-1">
                    <span>
                      {msg.status === "pending" ? "Sending..." : safeFormat(msg.created_at, "h:mm a")}
                    </span>
                    {isMe && !isCall && (
                      msg.status === "read" ? (
                        <span title="Read" className="text-[#34C759] dark:text-[#30D158] inline-flex items-center">
                          <CheckCheck weight="bold" className="h-3 w-3" />
                        </span>
                      ) : msg.status === "delivered" ? (
                        <span title="Delivered" className="opacity-75 inline-flex items-center">
                          <CheckCheck weight="bold" className="h-3 w-3" />
                        </span>
                      ) : (
                        <span title="Sent" className="opacity-75 inline-flex items-center">
                          <CheckIcon weight="bold" className="h-3 w-3" />
                        </span>
                      )
                    )}
                  </span>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* ── Composer ── */}
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
            className="flex-1 h-9 px-3 text-xs rounded-lg bg-muted/60 border border-border/60 outline-none focus:ring-1 focus:ring-[#2164b6] focus:bg-background transition-all"
          />
          <EmojiPickerPopover
            onSelect={(emoji) => setInputText((prev) => prev + emoji)}
            align="right"
            buttonClassName="h-9 w-9 rounded-lg"
          />
          <button
            type="submit"
            disabled={!inputText.trim() || sending}
            className="h-9 w-9 rounded-lg bg-[#2164b6] text-white flex items-center justify-center disabled:opacity-40 hover:bg-[#1a5091] active:scale-95 transition-all flex-shrink-0"
          >
            <PaperPlaneRight weight="fill" className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
