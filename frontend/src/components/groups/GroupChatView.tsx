import * as React from "react";
import {
  PaperPlaneTilt,
  Smiley,
  Image as ImageIcon,
  ArrowBendUpLeft,
  X,
  Check,
  SpinnerGap,
  ChatCircleDots,
  Crown,
  Lock,
} from "@phosphor-icons/react";
import { useAuth } from "@/hooks/useAuth";
import { useRealtimeMessaging } from "@/hooks/useRealtimeMessaging";
import { apiClient } from "@/lib/api/client";
import type { Group } from "@/types/group";
import type { ChatMessage } from "@/types/chat";

interface GroupChatViewProps {
  group: Group;
}

const QUICK_REACTIONS = ["👍", "❤️", "🔥", "😂", "👏", "🎉"];

function formatChatTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  } catch {
    return "";
  }
}

function formatDateSeparator(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) return "Today";
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return "";
  }
}

export function GroupChatView({ group }: GroupChatViewProps) {
  const { user } = useAuth();
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [sending, setSending] = React.useState(false);
  const [inputText, setInputText] = React.useState("");
  const [replyingTo, setReplyingTo] = React.useState<ChatMessage | null>(null);
  const [typingUsers, setTypingUsers] = React.useState<Map<number, string>>(new Map());
  const [showAttachmentInput, setShowAttachmentInput] = React.useState(false);
  const [attachmentUrl, setAttachmentUrl] = React.useState("");
  const attachmentType = "image";
  const [reactionPickerMsgId, setReactionPickerMsgId] = React.useState<number | null>(null);

  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);

  const conversationId = group.conversation_id || null;

  // Auto-scroll to bottom
  const scrollToBottom = (smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });
  };

  // Fetch message history
  const fetchMessages = React.useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.get(`/groups/${group.id}/chat/messages`);
      const raw = res.data?.messages || res.data?.data?.data || [];
      setMessages(raw);
      setTimeout(() => scrollToBottom(false), 100);
    } catch (err) {
      console.error("Failed to load group messages", err);
    } finally {
      setLoading(false);
    }
  }, [group.id]);

  React.useEffect(() => {
    if (group.is_member) {
      fetchMessages();
    }
  }, [group.id, group.is_member, fetchMessages]);

  // Real-time integration via Echo hook
  useRealtimeMessaging(conversationId, user?.id, {
    onMessageReceived: (newMsg) => {
      setMessages((prev) => {
        // Prevent duplicate by client_uuid or id
        if (newMsg.client_uuid && prev.some((m) => m.client_uuid === newMsg.client_uuid)) {
          return prev.map((m) => (m.client_uuid === newMsg.client_uuid ? newMsg : m));
        }
        if (newMsg.id && prev.some((m) => m.id === newMsg.id)) {
          return prev;
        }
        return [...prev, newMsg];
      });
      setTimeout(() => scrollToBottom(true), 50);
    },
    onTyping: ({ user_id, user_name, is_typing }) => {
      setTypingUsers((prev) => {
        const next = new Map(prev);
        if (is_typing) {
          next.set(user_id, user_name);
        } else {
          next.delete(user_id);
        }
        return next;
      });
    },
    onReaction: ({ message_id, reactions }) => {
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id === message_id) {
            return { ...m, reactions };
          }
          return m;
        })
      );
    },
  });

  // Handle send message
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const content = inputText.trim();
    if (!content && !attachmentUrl.trim()) return;

    const clientUuid = `cli-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const tempMessage: ChatMessage = {
      conversation_id: conversationId || 0,
      user_id: user?.id || 0,
      content,
      type: attachmentUrl ? attachmentType : "text",
      client_uuid: clientUuid,
      status: "pending",
      reply_to_id: replyingTo?.id,
      reply_to: replyingTo
        ? {
            id: replyingTo.id!,
            user_id: replyingTo.user_id,
            content: replyingTo.content,
            user: replyingTo.user ? { id: replyingTo.user.id, name: replyingTo.user.name, username: replyingTo.user.username } : undefined,
          }
        : undefined,
      attachment_url: attachmentUrl.trim() || undefined,
      attachment_type: attachmentUrl.trim() ? attachmentType : undefined,
      created_at: new Date().toISOString(),
      user: {
        id: user?.id || 0,
        name: user?.name || "You",
        username: user?.username || "you",
        avatar_url: (user as any)?.avatar || (user as any)?.avatar_url,
      },
    };

    // Optimistic append
    setMessages((prev) => [...prev, tempMessage]);
    setInputText("");
    setReplyingTo(null);
    setAttachmentUrl("");
    setShowAttachmentInput(false);
    setTimeout(() => scrollToBottom(true), 50);

    try {
      setSending(true);
      const res = await apiClient.post(`/groups/${group.id}/chat/messages`, {
        content,
        attachment_url: tempMessage.attachment_url,
        attachment_type: tempMessage.attachment_type,
        reply_to_id: tempMessage.reply_to_id,
        client_uuid: clientUuid,
      });

      const savedMsg = res.data?.data;
      if (savedMsg) {
        setMessages((prev) =>
          prev.map((m) => (m.client_uuid === clientUuid ? { ...savedMsg, status: "sent" } : m))
        );
      }
    } catch (err) {
      console.error("Failed to send message", err);
      setMessages((prev) =>
        prev.map((m) => (m.client_uuid === clientUuid ? { ...m, status: "failed" } : m))
      );
    } finally {
      setSending(false);
    }
  };

  // Add emoji reaction
  const handleReactionClick = async (messageId: number, emoji: string) => {
    setReactionPickerMsgId(null);
    try {
      const res = await apiClient.post(`/messages/${messageId}/reactions`, { emoji });
      const updatedReactions = res.data?.reactions;
      if (updatedReactions) {
        setMessages((prev) =>
          prev.map((m) => (m.id === messageId ? { ...m, reactions: updatedReactions } : m))
        );
      }
    } catch {
      // Graceful fallback
    }
  };

  if (!group.is_member) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
        <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4 text-primary">
          <Lock weight="fill" className="h-8 w-8" />
        </div>
        <h3 className="text-xl font-bold mb-2">Members-Only Chat</h3>
        <p className="text-muted-foreground text-sm max-w-md mb-6">
          Join this group to read real-time conversations, ask questions, and share updates with members.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[680px] max-h-[80vh] rounded-3xl border border-border/80 bg-card/60 backdrop-blur-sm overflow-hidden shadow-sm">
      {/* Group Chat Top Bar */}
      <div className="px-5 py-3 border-b border-border/70 flex items-center justify-between bg-muted/20">
        <div className="flex items-center gap-3">
          <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <div>
            <span className="font-semibold text-sm">Group Live Chat</span>
            <span className="text-xs text-muted-foreground ml-2">
              {group.members_count} {group.members_count === 1 ? "member" : "members"}
            </span>
          </div>
        </div>
        <div className="text-xs text-muted-foreground">
          {typingUsers.size > 0 ? (
            <span className="text-primary italic animate-pulse">
              {Array.from(typingUsers.values()).join(", ")} {typingUsers.size === 1 ? "is" : "are"} typing...
            </span>
          ) : (
            <span>Real-time connected</span>
          )}
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
            <SpinnerGap className="h-6 w-6 animate-spin text-primary" />
            <span className="text-xs font-medium">Connecting to group conversation...</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4 text-muted-foreground">
            <div className="h-14 w-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-3">
              <ChatCircleDots weight="fill" className="h-7 w-7" />
            </div>
            <h4 className="font-semibold text-foreground mb-1 text-center">No messages yet</h4>
            <p className="text-xs max-w-sm text-muted-foreground text-center mx-auto">
              Say hello to the group! Break the ice and start the discussion.
            </p>
          </div>
        ) : (
          messages.map((msg, index) => {
            const isMe = msg.user_id === user?.id;
            const prevMsg = messages[index - 1];
            const showDate =
              !prevMsg ||
              new Date(msg.created_at).toDateString() !== new Date(prevMsg.created_at).toDateString();
            const showAvatar = !isMe && (!prevMsg || prevMsg.user_id !== msg.user_id);

            return (
              <React.Fragment key={msg.id || msg.client_uuid || index}>
                {showDate && (
                  <div className="flex justify-center my-3">
                    <span className="text-[11px] font-medium px-3 py-1 rounded-full bg-muted/60 text-muted-foreground border border-border/40">
                      {formatDateSeparator(msg.created_at)}
                    </span>
                  </div>
                )}

                <div
                  className={`group relative flex gap-2.5 items-end ${
                    isMe ? "justify-end" : "justify-start"
                  }`}
                >
                  {/* Sender Avatar */}
                  {!isMe && (
                    <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 bg-muted border border-border/60">
                      {showAvatar ? (
                        msg.user?.avatar_url ? (
                          <img
                            src={msg.user.avatar_url}
                            alt={msg.user.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-xs font-bold text-muted-foreground uppercase">
                            {msg.user?.name?.charAt(0) || "U"}
                          </div>
                        )
                      ) : (
                        <div className="w-8" />
                      )}
                    </div>
                  )}

                  {/* Bubble Content */}
                  <div
                    className={`relative max-w-[85%] sm:max-w-[70%] rounded-2xl px-4 py-2.5 shadow-sm transition-all ${
                      isMe
                        ? "bg-primary text-primary-foreground rounded-br-xs"
                        : "bg-muted/80 dark:bg-muted/40 border border-border/60 text-foreground rounded-bl-xs"
                    }`}
                  >
                    {/* Sender Name & Role */}
                    {!isMe && showAvatar && (
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-xs font-semibold text-primary">
                          {msg.user?.name}
                        </span>
                        {group.creator_id === msg.user_id && (
                          <span className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.2 rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400 font-medium">
                            <Crown weight="fill" className="h-3 w-3" /> Owner
                          </span>
                        )}
                      </div>
                    )}

                    {/* Quoted Reply */}
                    {msg.reply_to && (
                      <div
                        className={`text-xs mb-2 p-2 rounded-xl border-l-3 ${
                          isMe
                            ? "bg-black/10 border-primary-foreground/40 text-primary-foreground/90"
                            : "bg-background/80 border-primary text-muted-foreground"
                        }`}
                      >
                        <div className="font-semibold text-[11px] mb-0.5">
                          {msg.reply_to.user?.name || "Replying"}
                        </div>
                        <p className="line-clamp-1 italic">{msg.reply_to.content}</p>
                      </div>
                    )}

                    {/* Media Image / File */}
                    {msg.attachment_url && (
                      <div className="mb-2 rounded-xl overflow-hidden max-w-sm">
                        {msg.attachment_type === "image" ? (
                          <img
                            src={msg.attachment_url}
                            alt="Attachment"
                            className="max-h-60 w-auto rounded-xl object-cover hover:opacity-95 cursor-pointer"
                            onClick={() => window.open(msg.attachment_url, "_blank")}
                          />
                        ) : (
                          <a
                            href={msg.attachment_url}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-2 p-2 rounded-xl bg-background/50 underline text-xs"
                          >
                            📎 View Attachment
                          </a>
                        )}
                      </div>
                    )}

                    {/* Text Message */}
                    {msg.content && (
                      <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                        {msg.content}
                      </p>
                    )}

                    {/* Timestamp & Status */}
                    <div
                      className={`flex items-center justify-end gap-1 mt-1 text-[10px] ${
                        isMe ? "text-primary-foreground/75" : "text-muted-foreground"
                      }`}
                    >
                      <span>{formatChatTime(msg.created_at)}</span>
                      {isMe && (
                        <span>
                          {msg.status === "pending" ? (
                            <SpinnerGap className="h-3 w-3 animate-spin" />
                          ) : (
                            <Check weight="bold" className="h-3 w-3" />
                          )}
                        </span>
                      )}
                    </div>

                    {/* Emoji Reactions List */}
                    {msg.reactions && msg.reactions.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5 -mb-1">
                        {msg.reactions.map((r, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => msg.id && handleReactionClick(msg.id, r.emoji)}
                            className={`text-xs px-1.5 py-0.5 rounded-full flex items-center gap-1 border transition-all ${
                              r.by_me
                                ? "bg-primary/20 border-primary text-foreground"
                                : "bg-background/60 border-border/70 text-muted-foreground hover:bg-background"
                            }`}
                          >
                            <span>{r.emoji}</span>
                            <span className="text-[10px] font-semibold">{r.count}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Hover Actions Pill */}
                  <div
                    className={`opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-background border border-border shadow-sm rounded-full px-1.5 py-0.5 ${
                      isMe ? "order-first" : ""
                    }`}
                  >
                    <button
                      type="button"
                      title="Reply"
                      onClick={() => setReplyingTo(msg)}
                      className="p-1 hover:bg-muted rounded-full text-muted-foreground hover:text-foreground"
                    >
                      <ArrowBendUpLeft className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      title="React"
                      onClick={() =>
                        setReactionPickerMsgId(reactionPickerMsgId === msg.id ? null : msg.id || null)
                      }
                      className="p-1 hover:bg-muted rounded-full text-muted-foreground hover:text-foreground"
                    >
                      <Smiley className="h-3.5 w-3.5" />
                    </button>

                    {/* Popover Reaction Bar */}
                    {reactionPickerMsgId === msg.id && (
                      <div className="absolute z-10 -top-10 flex items-center gap-1 bg-background border border-border shadow-xl rounded-full px-2 py-1 animate-in fade-in zoom-in-95">
                        {QUICK_REACTIONS.map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => msg.id && handleReactionClick(msg.id, emoji)}
                            className="hover:scale-125 transition-transform p-1 text-sm"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </React.Fragment>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Reply Banner */}
      {replyingTo && (
        <div className="px-4 py-2 border-t border-border/60 bg-muted/40 flex items-center justify-between">
          <div className="flex items-center gap-2 overflow-hidden text-xs">
            <ArrowBendUpLeft weight="bold" className="h-4 w-4 text-primary flex-shrink-0" />
            <span className="font-semibold text-primary truncate">
              Replying to {replyingTo.user?.name || "Member"}:
            </span>
            <span className="text-muted-foreground truncate">{replyingTo.content}</span>
          </div>
          <button
            type="button"
            onClick={() => setReplyingTo(null)}
            className="p-1 hover:bg-muted rounded-full text-muted-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Attachment URL drawer */}
      {showAttachmentInput && (
        <div className="px-4 py-2 border-t border-border/60 bg-muted/30 flex items-center gap-2">
          <input
            type="url"
            placeholder="Paste image or media URL..."
            value={attachmentUrl}
            onChange={(e) => setAttachmentUrl(e.target.value)}
            className="flex-1 h-9 rounded-xl border border-border px-3 text-xs bg-background focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <button
            type="button"
            onClick={() => setShowAttachmentInput(false)}
            className="p-1.5 hover:bg-muted rounded-xl text-muted-foreground text-xs"
          >
            Close
          </button>
        </div>
      )}

      {/* Input Composer */}
      {group.can_chat ? (
        <form
          onSubmit={handleSendMessage}
          className="p-3 sm:p-4 border-t border-border/70 bg-background/80 backdrop-blur-md flex items-end gap-2"
        >
          <div className="flex items-center gap-1 mb-1">
            <button
              type="button"
              onClick={() => setShowAttachmentInput(!showAttachmentInput)}
              className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="Add Image or File"
            >
              <ImageIcon className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 relative">
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder="Message group... (Press Enter to send)"
              rows={1}
              className="w-full min-h-[42px] max-h-32 py-2.5 px-4 rounded-2xl bg-muted/50 dark:bg-muted/30 border border-border/70 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={sending || (!inputText.trim() && !attachmentUrl.trim())}
            className="h-[42px] w-[42px] rounded-2xl bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-all disabled:opacity-40 disabled:pointer-events-none flex-shrink-0 shadow-sm"
          >
            {sending ? (
              <SpinnerGap className="h-5 w-5 animate-spin" />
            ) : (
              <PaperPlaneTilt weight="fill" className="h-5 w-5" />
            )}
          </button>
        </form>
      ) : (
        <div className="p-4 border-t border-border/70 bg-muted/20 text-center text-xs text-muted-foreground">
          Chat is restricted in this group or you are temporarily muted by moderators.
        </div>
      )}
    </div>
  );
}
