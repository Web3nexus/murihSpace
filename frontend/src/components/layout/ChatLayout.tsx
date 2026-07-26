import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  MessageSquare, Search, Send, Loader2, Bookmark, Users, ArrowLeft,
  AlertCircle, RotateCcw, Sparkles, BellOff, Archive, MoreVertical,
  Reply, Paperclip, CheckCheck,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import type { ConversationItem, ChatMessage, MessageStatus, MessageReaction } from '@/types/chat';
import { ReplyPreviewBar } from '@/components/chat/ReplyPreviewBar';
import { MessageReactions } from '@/components/chat/MessageReactions';
import { useRealtimeMessaging } from '@/hooks/useRealtimeMessaging';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api/v1';

function getToken(): string | null {
  return localStorage.getItem('murihspace-token');
}

function getUserData(): Record<string, unknown> {
  try {
    return JSON.parse(localStorage.getItem('user_data') ?? '{}');
  } catch {
    return {};
  }
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
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

function Avatar({ name, src, size = 36 }: { name?: string; src?: string; size?: number }) {
  const initials = name ? name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() : '?';
  if (src) return <img src={src} alt={name} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />;
  return (
    <div className="flex items-center justify-center rounded-full bg-gradient-to-br from-primary to-secondary text-white font-bold shrink-0 shadow-sm" style={{ width: size, height: size, fontSize: size * 0.35 }}>
      {initials}
    </div>
  );
}

export function ChatLayout() {
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [activeConv, setActiveConv] = useState<ConversationItem | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [isLoadingMsgs, setIsLoadingMsgs] = useState(false);
  const [filterTab, setFilterTab] = useState<'all' | 'channels' | 'direct'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [inputContent, setInputContent] = useState('');
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isArchived, setIsArchived] = useState(false);
  const [uploading, setUploading] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const currentUserData = getUserData();
  const currentUserId = (currentUserData?.id as number | undefined) ?? undefined;

  useRealtimeMessaging(activeConv?.id ?? null, currentUserId, {
    onMessageReceived: useCallback((msg: ChatMessage) => {
      setMessages((prev) => {
        if (prev.some((m) => m.client_uuid && m.client_uuid === msg.client_uuid)) return prev;
        if (prev.some((m) => m.id && m.id === msg.id)) return prev;
        return [...prev, { ...msg, status: 'sent' }];
      });
      setConversations((prev) => prev.map((c) =>
        c.id === msg.conversation_id
          ? { ...c, latest_message: msg, updated_at: msg.created_at, unread_count: c.id === activeConv?.id ? 0 : (c.unread_count ?? 0) + 1 }
          : c,
      ));
    }, [activeConv?.id]),
    onTyping: useCallback((data) => {
      if (data.is_typing) {
        setTypingUsers((prev) => prev.includes(data.user_name) ? prev : [...prev, data.user_name]);
      } else {
        setTypingUsers((prev) => prev.filter((n) => n !== data.user_name));
      }
    }, []),
    onReaction: useCallback((data) => {
      setMessages((prev) => prev.map((m) =>
        m.id === data.message_id ? { ...m, reactions: data.reactions } : m,
      ));
    }, []),
  });

  const loadConversations = useCallback(async () => {
    try {
      const res = await apiFetch<{ data: ConversationItem[] }>('/conversations');
      setConversations(Array.isArray(res.data) ? res.data : []);
    } catch (e) { console.error('Failed to load conversations', e);
    } finally {
      setIsLoadingList(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadConversations();
  }, [loadConversations]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const loadConvSettings = async (convId: number) => {
    try {
      const res = await apiFetch<{ data: { is_muted: boolean; is_archived: boolean } }>(`/conversations/${convId}/settings`);
      setIsMuted(res.data?.is_muted ?? false);
      setIsArchived(res.data?.is_archived ?? false);
    } catch (e) { console.error('Failed to load conv settings', e); }
  };

  const selectConversation = async (conv: ConversationItem) => {
    setActiveConv(conv);
    setReplyingTo(null);
    setIsLoadingMsgs(true);
    setTypingUsers([]);

    try {
      const res = await apiFetch<{ data: ChatMessage[] }>(`/conversations/${conv.id}/messages`);
      const list = res && 'data' in res ? res.data : Array.isArray(res) ? res : [];
      const formatted = (Array.isArray(list) ? list : []).map((m: ChatMessage) => ({ ...m, status: 'sent' as MessageStatus }));
      setMessages(formatted);

      if (conv.unread_count > 0) {
        await apiFetch(`/conversations/${conv.id}/read`, { method: 'POST' });
        setConversations((prev) => prev.map((c) => (c.id === conv.id ? { ...c, unread_count: 0 } : c)));
      }
    } catch (e) {
      console.error('Failed to select conversation', e);
      setMessages([]);
    } finally {
      setIsLoadingMsgs(false);
    }

    loadConvSettings(conv.id);
  };

  const openSavedMessages = async () => {
    try {
      const res = await apiFetch<{ data: Pick<ConversationItem, 'id' | 'updated_at'> }>('/conversations/saved');
      const conv = res.data;
      const fullItem: ConversationItem = { id: conv.id, type: 'saved', title: 'Saved Messages', unread_count: 0, updated_at: conv.updated_at };
      selectConversation(fullItem);
      loadConversations();
    } catch (e) { console.error('Failed to open saved messages', e); }
  };

  const executeSendMessage = async (msg: ChatMessage) => {
    if (!activeConv) return;
    setMessages((prev) => prev.map((m) => (m.client_uuid === msg.client_uuid ? { ...m, status: 'pending' } : m)));
    try {
      const res = await apiFetch<{ data: ChatMessage }>(`/conversations/${activeConv.id}/messages`, {
        method: 'POST',
        body: JSON.stringify({
          content: msg.content,
          client_uuid: msg.client_uuid,
          reply_to_id: msg.reply_to_id ?? null,
          attachment_url: msg.attachment_url ?? null,
          attachment_type: msg.attachment_type ?? null,
        }),
      });
      const serverMsg = (res as { data: ChatMessage })?.data ?? res;
      setMessages((prev) => prev.map((m) => m.client_uuid === msg.client_uuid ? { ...serverMsg, status: 'sent', client_uuid: msg.client_uuid } : m));
      setConversations((prev) => prev.map((c) => c.id === activeConv.id ? { ...c, latest_message: serverMsg, updated_at: serverMsg.created_at } : c));
    } catch (e) {
      console.error('Failed to send message', e);
      setMessages((prev) => prev.map((m) => (m.client_uuid === msg.client_uuid ? { ...m, status: 'failed' } : m)));
    }
  };

  const handleTypingDebounced = async () => {
    if (!activeConv) return;
    try {
      await apiFetch(`/conversations/${activeConv.id}/typing`, { method: 'POST', body: JSON.stringify({ is_typing: true }) });
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(async () => {
        try { await apiFetch(`/conversations/${activeConv.id}/typing`, { method: 'POST', body: JSON.stringify({ is_typing: false }) }); } catch (e) { console.error('Failed to stop typing', e); }
      }, 2500);
    } catch (e) { console.error('Failed to send typing indicator', e); }
  };

  const handleSendMessage = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!activeConv || !inputContent.trim()) return;
    const contentText = inputContent.trim();
    setInputContent('');
    const clientUuid = crypto.randomUUID ? crypto.randomUUID() : `uuid-${Date.now()}`;

    const draft: ChatMessage = {
      conversation_id: activeConv.id,
      user_id: currentUserId ?? 0,
      content: contentText,
      type: 'text',
      client_uuid: clientUuid,
      status: 'pending',
      reply_to_id: replyingTo?.id ?? undefined,
      reply_to: replyingTo ? { id: replyingTo.id!, user_id: replyingTo.user_id, content: replyingTo.content } : undefined,
      created_at: new Date().toISOString(),
      user: { id: currentUserId ?? 0, name: (currentUserData?.name as string) ?? 'You', username: (currentUserData?.username as string) ?? 'you' },
    };

    setReplyingTo(null);
    setMessages((prev) => [...prev, draft]);
    executeSendMessage(draft);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeConv) return;
    e.target.value = '';

    setUploading(true);
    try {
      const token = getToken();
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`${API_BASE}/messages/attachments`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: formData,
      });

      if (!res.ok) throw new Error('Upload failed');
      const json = await res.json();
      const { attachment_url, attachment_type } = json.data;

      const clientUuid = crypto.randomUUID ? crypto.randomUUID() : `uuid-${Date.now()}`;
      const draft: ChatMessage = {
        conversation_id: activeConv.id,
        user_id: currentUserId ?? 0,
        content: '',
        type: attachment_type as ChatMessage['type'],
        client_uuid: clientUuid,
        status: 'pending',
        attachment_url,
        attachment_type: attachment_type as ChatMessage['attachment_type'],
        created_at: new Date().toISOString(),
        user: { id: currentUserId ?? 0, name: (currentUserData?.name as string) ?? 'You', username: (currentUserData?.username as string) ?? 'you' },
      };

      setMessages((prev) => [...prev, draft]);
      executeSendMessage(draft);
    } catch (err) {
      console.error('Failed to upload file', err);
    } finally {
      setUploading(false);
    }
  };

  const handleToggleSetting = async (key: 'is_muted' | 'is_archived') => {
    if (!activeConv) return;
    const newVal = key === 'is_muted' ? !isMuted : !isArchived;
    try {
      await apiFetch(`/conversations/${activeConv.id}/settings`, { method: 'PUT', body: JSON.stringify({ [key]: newVal }) });
      if (key === 'is_muted') setIsMuted(newVal);
      else setIsArchived(newVal);
    } catch (e) { console.error('Failed to toggle setting', e); }
    setShowHeaderMenu(false);
  };

  const handleReactionToggle = (messageId: number, updated: MessageReaction[]) => {
    setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, reactions: updated } : m)));
  };

  const filteredConversations = conversations.filter((c) => {
    if (filterTab === 'channels' && c.type !== 'community') return false;
    if (filterTab === 'direct' && c.type !== 'direct') return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return c.title.toLowerCase().includes(q) || c.latest_message?.content?.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="-mx-6 -my-4 flex h-[calc(100svh-68px)] overflow-hidden bg-background">
      {/* ── Sidebar ───────────────────────────────────────────────────────── */}
      <aside className={`${activeConv ? 'hidden md:flex' : 'flex'} w-full md:w-[340px] shrink-0 flex-col border-r border-border bg-card`}>
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-border bg-muted/20">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-secondary" />
            <h2 className="text-base font-bold text-foreground">Messages</h2>
          </div>
          <button onClick={openSavedMessages} className="p-1.5 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5 text-xs font-semibold" title="Saved Messages">
            <Bookmark className="h-4 w-4 text-amber-500" />
            <span className="hidden sm:inline">Saved</span>
          </button>
        </div>

        <div className="px-3 py-2.5 border-b border-border">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input type="search" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search conversations…" className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-muted border-0 outline-none focus:ring-1 focus:ring-secondary placeholder:text-muted-foreground" />
          </div>
        </div>

        <div className="flex gap-1 px-3 py-2 border-b border-border bg-muted/10">
          {(['all', 'channels', 'direct'] as const).map((tab) => (
            <button key={tab} onClick={() => setFilterTab(tab)} className={`px-3 py-1 text-xs font-semibold rounded-lg capitalize transition-all ${filterTab === tab ? 'bg-secondary text-secondary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted'}`}>{tab}</button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-border/40">
          {isLoadingList ? (
            <div className="py-12 text-center space-y-2"><Loader2 className="h-6 w-6 animate-spin text-secondary mx-auto" /><p className="text-xs text-muted-foreground font-medium">Loading conversations…</p></div>
          ) : filteredConversations.length === 0 ? (
            <div className="p-8 text-center space-y-2"><MessageSquare className="h-8 w-8 text-muted-foreground/30 mx-auto" /><p className="text-xs font-bold text-foreground">No conversations found</p></div>
          ) : filteredConversations.map((c) => {
            const isSelected = activeConv?.id === c.id;
            const timeFormatted = c.latest_message ? formatDistanceToNow(new Date(c.latest_message.created_at), { addSuffix: false }) : '';
            return (
              <button key={c.id} onClick={() => selectConversation(c)} className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${isSelected ? 'bg-secondary/15 border-l-4 border-secondary' : 'hover:bg-muted/40'}`}>
                {c.type === 'saved' ? <div className="h-9 w-9 rounded-full bg-amber-500/20 text-amber-500 flex items-center justify-center shrink-0"><Bookmark className="h-4 w-4" /></div>
                  : c.type === 'community' ? <div className="h-9 w-9 rounded-full bg-secondary/20 text-secondary flex items-center justify-center shrink-0"><Users className="h-4 w-4" /></div>
                  : <Avatar name={c.other_user?.name ?? c.title} src={c.other_user?.avatar_url} size={36} />}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground truncate flex items-center gap-1">
                      {c.is_muted && <BellOff className="h-3 w-3 text-muted-foreground shrink-0" />}
                      {c.title}
                    </span>
                    {timeFormatted && <span className="text-[10px] text-muted-foreground shrink-0 ml-1">{timeFormatted}</span>}
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate mt-0.5">{c.latest_message ? c.latest_message.content : 'No messages yet'}</p>
                </div>
                {c.unread_count > 0 && <span className="h-4 min-w-4 px-1 rounded-full bg-secondary text-secondary-foreground text-[10px] font-extrabold flex items-center justify-center shrink-0 shadow-sm">{c.unread_count}</span>}
              </button>
            );
          })}
        </div>
      </aside>

      {/* ── Main Chat Area ─────────────────────────────────────────────────── */}
      <main className={`${activeConv ? 'flex' : 'hidden md:flex'} flex-1 flex-col bg-background`}>
        {activeConv ? (
          <>
            {/* Header */}
            <div className="px-4 py-3 border-b border-border bg-card flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button onClick={() => setActiveConv(null)} className="md:hidden p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><ArrowLeft className="h-5 w-5" /></button>
                {activeConv.type === 'saved' ? <div className="h-9 w-9 rounded-full bg-amber-500/20 text-amber-500 flex items-center justify-center shrink-0"><Bookmark className="h-4 w-4" /></div>
                  : activeConv.type === 'community' ? <div className="h-9 w-9 rounded-full bg-secondary/20 text-secondary flex items-center justify-center shrink-0"><Users className="h-4 w-4" /></div>
                  : <Avatar name={activeConv.other_user?.name ?? activeConv.title} src={activeConv.other_user?.avatar_url} size={36} />}
                <div>
                  <h3 className="text-xs sm:text-sm font-extrabold text-foreground flex items-center gap-1.5">
                    {isMuted && <BellOff className="h-3.5 w-3.5 text-muted-foreground" />}
                    {activeConv.title}
                  </h3>
                  <span className="text-[10px] text-muted-foreground capitalize">
                    {activeConv.type === 'community' ? 'Community General Channel' : activeConv.type === 'saved' ? 'Personal Notes' : 'Direct Message'}
                  </span>
                </div>
              </div>

              {/* Header action menu */}
              <div className="relative">
                <button onClick={() => setShowHeaderMenu((v) => !v)} className="p-1.5 rounded-xl hover:bg-muted text-muted-foreground transition-colors"><MoreVertical className="h-4 w-4" /></button>
                {showHeaderMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowHeaderMenu(false)} role="presentation" onKeyDown={(e) => e.key === 'Enter' && setShowHeaderMenu(false)} />
                    <div className="absolute right-0 top-8 z-50 w-44 rounded-xl border border-border bg-card shadow-xl p-1 text-xs space-y-0.5">
                      <button onClick={() => handleToggleSetting('is_muted')} className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-muted text-foreground font-medium">
                        <BellOff className="h-3.5 w-3.5 text-muted-foreground" /> {isMuted ? 'Unmute' : 'Mute'} conversation
                      </button>
                      <button onClick={() => handleToggleSetting('is_archived')} className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-muted text-foreground font-medium">
                        <Archive className="h-3.5 w-3.5 text-muted-foreground" /> {isArchived ? 'Unarchive' : 'Archive'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Message Stream */}
            <div className="flex-1 overflow-y-auto p-4 space-y-1 bg-muted/10">
              {isLoadingMsgs ? (
                <div className="py-20 text-center space-y-2"><Loader2 className="h-6 w-6 animate-spin text-secondary mx-auto" /><p className="text-xs text-muted-foreground">Loading message history…</p></div>
              ) : messages.length === 0 ? (
                <div className="py-20 text-center space-y-2"><Sparkles className="h-8 w-8 text-secondary/40 mx-auto" /><p className="text-xs font-bold text-foreground">Start the conversation!</p></div>
              ) : messages.map((msg) => {
                const isMine = msg.user_id === currentUserId;
                const isPending = msg.status === 'pending';
                const isFailed = msg.status === 'failed';

                return (
                  <div key={msg.client_uuid || msg.id} className={`group flex items-end gap-2 ${isMine ? 'justify-end' : 'justify-start'} mb-1`}>
                    {!isMine && <Avatar name={msg.user?.name} src={msg.user?.avatar_url} size={28} />}

                    <div className="max-w-[75%] sm:max-w-[65%] space-y-1">
                      {/* Reply context */}
                      {msg.reply_to && (
                        <div className={`px-2.5 py-1.5 rounded-xl text-[10px] border-l-2 border-secondary bg-secondary/10 text-muted-foreground ${isMine ? 'ml-auto' : ''}`}>
                          <span className="font-bold text-secondary">{msg.reply_to.user?.name ?? 'User'}</span>
                          <p className="truncate">{msg.reply_to.content?.slice(0, 60)}</p>
                        </div>
                      )}

                      <div className={`p-3 rounded-2xl text-xs space-y-1 ${isMine ? (isFailed ? 'bg-destructive/15 border border-destructive/40 text-foreground rounded-br-none' : isPending ? 'bg-secondary/70 text-secondary-foreground rounded-br-none opacity-85 shadow-sm' : 'bg-secondary text-secondary-foreground rounded-br-none shadow-sm') : 'bg-card border border-border text-foreground rounded-bl-none shadow-sm'}`}>
                        {!isMine && msg.user?.name && <span className="block text-[10px] font-bold text-secondary">{msg.user.name}</span>}

                        {/* Attachment */}
                        {msg.attachment_url && (
                          msg.attachment_type === 'image'
                            ? <img src={msg.attachment_url} alt="attachment" className="max-w-full rounded-xl max-h-48 object-cover mb-1" />
                            : <a href={msg.attachment_url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-xs font-semibold underline"><Paperclip className="h-3.5 w-3.5" /> Attachment</a>
                        )}

                        <p className="leading-relaxed whitespace-pre-wrap break-words font-normal">{msg.content}</p>

                        <div className="flex items-center justify-end gap-1 text-[9px] opacity-80 pt-0.5">
                          <span>{format(new Date(msg.created_at), 'h:mm a')}</span>
                          {isMine && (isPending ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : isFailed ? <AlertCircle className="h-2.5 w-2.5 text-destructive" /> : <CheckCheck className="h-2.5 w-2.5" />)}
                        </div>

                        {isFailed && (
                          <button onClick={() => executeSendMessage(msg)} className="mt-1 flex items-center gap-1 text-[10px] font-extrabold text-destructive hover:underline">
                            <RotateCcw className="h-3 w-3" /> Retry sending
                          </button>
                        )}
                      </div>

                      {/* Reactions */}
                      {msg.id && (
                        <div className={`px-1 ${isMine ? 'flex justify-end' : ''}`}>
                          <MessageReactions messageId={msg.id} reactions={msg.reactions ?? []} onReactionToggle={handleReactionToggle} />
                        </div>
                      )}
                    </div>

                    {/* Reply button (shows on hover) */}
                    <button
                      onClick={() => setReplyingTo(msg)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground shrink-0 mb-1"
                      title="Reply"
                    >
                      <Reply className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}

              {/* Typing indicator */}
              {typingUsers.length > 0 && (
                <div className="flex items-center gap-2 px-2">
                  <div className="flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <span key={i} className="h-1.5 w-1.5 rounded-full bg-secondary animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
                    ))}
                  </div>
                  <span className="text-[11px] text-muted-foreground italic">{typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing…</span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Reply preview bar */}
            {replyingTo && <ReplyPreviewBar replyingTo={replyingTo} onDismiss={() => setReplyingTo(null)} />}

            {/* Composer */}
            <form onSubmit={handleSendMessage} className="p-3 border-t border-border bg-card flex items-center gap-2">
              {/* Attachment button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="p-2 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0 disabled:opacity-50"
                title="Attach file"
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
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
                placeholder={`Message ${activeConv.title}…`}
                className="flex-1 px-4 py-2.5 text-xs rounded-xl bg-muted border-0 outline-none focus:ring-1 focus:ring-secondary placeholder:text-muted-foreground"
              />
              <button type="submit" disabled={!inputContent.trim() || uploading} className="p-2.5 rounded-xl bg-secondary text-secondary-foreground font-bold hover:bg-secondary/90 disabled:opacity-50 transition-all shrink-0 shadow-sm">
                <Send className="h-4 w-4" />
              </button>
            </form>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center px-6">
            <div className="rounded-2xl bg-secondary/10 p-5 text-secondary border border-secondary/20"><MessageSquare className="h-10 w-10" /></div>
            <div className="space-y-1">
              <h3 className="text-base font-extrabold text-foreground">Your Messages Hub</h3>
              <p className="text-xs text-muted-foreground max-w-sm">Select a conversation or open Saved Messages to start chatting.</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
