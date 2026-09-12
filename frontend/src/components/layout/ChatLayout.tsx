import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router';
import {
  ChatTeardropText as MessageSquare,
  MagnifyingGlass as Search,
  PaperPlaneRight as Send,
  Spinner as Loader2,
  BookmarkSimple as Bookmark,
  Users as Users,
  ArrowLeft as ArrowLeft,
  WarningCircle as AlertCircle,
  ArrowCounterClockwise as RotateCcw,
  BellSlash as BellOff,
  Archive as Archive,
  DotsThreeVertical as MoreVertical,
  ArrowUUpLeft as Reply,
  Paperclip as Paperclip,
  Checks as CheckCheck,
  User as UserIcon,
  ChatCircleDots as ChatBubble,
  Storefront as Storefront,
  UserPlus as UserPlus,
  Shield as Shield,
  Copy as Copy,
  TrashSimple as Trash,
  X as X
} from "@phosphor-icons/react";
import { toast } from 'sonner';
import { safeFormatDistanceToNow, safeFormat } from '@/lib/date';
import { extractMessages } from '@/lib/chatMessages';
import type { ConversationItem, ChatMessage, MessageStatus, MessageReaction } from '@/types/chat';
import { ReplyPreviewBar } from '@/components/chat/ReplyPreviewBar';
import { MessageReactions } from '@/components/chat/MessageReactions';
import { StoriesCarousel, type StoryUser } from '../chat/StoriesCarousel';
import { StoryCreateModal } from '../story/StoryCreateModal';
import { NewChatModal } from '@/components/chat/NewChatModal';
import { CallOverlayModal, type CallMode } from '@/components/video/CallOverlayModal';
import { useRealtimeMessaging } from '@/hooks/useRealtimeMessaging';
import { useAuth } from '@/hooks/useAuth';
import { getAuthToken } from "@/lib/auth/token";
import {
  Plus as Plus,
  VideoCamera as Video
} from "@phosphor-icons/react";

const API_BASE = (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL) ?? 'http://localhost:8000/api/v1';

function getToken(): string | null {
  return getAuthToken();
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
  if (src) return <img src={src} alt={name} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />;
  return (
    <div className="flex items-center justify-center rounded-full bg-gradient-to-br from-primary to-secondary text-white shrink-0" style={{ width: size, height: size }}>
      <UserIcon weight="fill" className="text-white/90" style={{ width: size * 0.55, height: size * 0.55 }} />
    </div>
  );
}

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥'];

type FilterTab = 'all' | 'app' | 'communities' | 'marketplace' | 'spam';
type FilterTabDef = { id: FilterTab | 'requests'; label: string; icon: React.ReactNode | null };

const FILTER_TABS: FilterTabDef[] = [
  { id: 'all', label: 'All', icon: null },
  { id: 'app', label: 'App', icon: <ChatBubble weight="fill" className="h-3 w-3" /> },
  { id: 'communities', label: 'Communities', icon: <Users weight="fill" className="h-3 w-3" /> },
  { id: 'marketplace', label: 'Marketplace', icon: <Storefront weight="fill" className="h-3 w-3" /> },
  { id: 'requests', label: 'Requests', icon: <UserPlus weight="fill" className="h-3 w-3" /> },
  { id: 'spam', label: 'Spam', icon: <Shield weight="fill" className="h-3 w-3" /> },
];

export function ChatLayout() {
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [activeConv, setActiveConv] = useState<ConversationItem | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [isLoadingMsgs, setIsLoadingMsgs] = useState(false);
  const [filterTab, setFilterTab] = useState<FilterTab>('all');
  const [showSaved, setShowSaved] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [inputContent, setInputContent] = useState('');
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isArchived, setIsArchived] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [isCallModalOpen, setIsCallModalOpen] = useState(false);
  const [callMode, setCallMode] = useState<CallMode>('video');
  const [isCreateStoryOpen, setIsCreateStoryOpen] = useState(false);
  const [storiesList, setStoriesList] = useState<StoryUser[]>([]);
  const [actionMenu, setActionMenu] = useState<{ msg: ChatMessage; x: number; y: number } | null>(null);
  const [emojiMenu, setEmojiMenu] = useState<{ msg: ChatMessage; x: number; y: number } | null>(null);
  const [forwardMsg, setForwardMsg] = useState<ChatMessage | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ChatMessage | null>(null);
  const dragStartRef = useRef<{ id?: number; x: number; dragged?: boolean } | null>(null);

  const { user } = useAuth();
  const currentUserId = user?.id;
  const currentUserName = user?.name || user?.username || 'there';
  const currentUserAvatar = (user as any)?.avatar_url || (user as any)?.avatar;

  useEffect(() => {
    let cancelled = false;
    apiFetch<any>('/stories')
      .then((data) => {
        if (cancelled) return;
        const list = Array.isArray(data) ? data : (data?.data ?? []);
        const mapped: StoryUser[] = list.map((item: any) => ({
          id: item.user?.id || Math.random(),
          name: item.user?.name || item.user?.username || 'Member',
          avatar_url: item.user?.avatar,
          hasUnreadStory: true,
        }));
        setStoriesList(mapped);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      const res = await apiFetch(`/conversations/${conv.id}/messages`);
      const list = extractMessages(res);
      const formatted = list.map((m) => ({ ...m, status: 'sent' as MessageStatus }));
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
      if (msg.conversation_id !== activeConv?.id) {
        const conv = conversations.find((c) => c.id === msg.conversation_id);
        const sender = msg.user?.name ?? conv?.title ?? 'New message';
        toast(sender, {
          description: msg.content || 'Sent an attachment',
          action: conv
            ? { label: 'View', onClick: () => selectConversation(conv) }
            : { label: 'Open', onClick: () => navigate('/app/messages') },
        });
      }
    }, [activeConv?.id, currentUserId, conversations, navigate, selectConversation]),
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
      const res = await apiFetch<{ data: ConversationItem[] } | ConversationItem[]>('/conversations');
      const list = 'data' in res ? res.data : res;
      setConversations(Array.isArray(list) ? list : []);
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

  const openSavedMessages = async () => {
    try {
      const res = await apiFetch<{ data: Pick<ConversationItem, 'id' | 'updated_at'> } | Pick<ConversationItem, 'id' | 'updated_at'>>('/conversations/saved');
      const conv = 'data' in res ? res.data : res;
      const fullItem: ConversationItem = { id: conv.id, type: 'saved', title: 'Saved Messages', unread_count: 0, updated_at: conv.updated_at };
      selectConversation(fullItem);
      loadConversations();
    } catch (e) { console.error('Failed to open saved messages', e); }
  };

  const executeSendMessage = async (msg: ChatMessage) => {
    if (!activeConv) return;
    setMessages((prev) => prev.map((m) => (m.client_uuid === msg.client_uuid ? { ...m, status: 'pending' } : m)));
    try {
      const res = await apiFetch<{ data: ChatMessage } | ChatMessage>(`/conversations/${activeConv.id}/messages`, {
        method: 'POST',
        body: JSON.stringify({
          content: msg.content,
          client_uuid: msg.client_uuid,
          reply_to_id: msg.reply_to_id ?? null,
          attachment_url: msg.attachment_url ?? null,
          attachment_type: msg.attachment_type ?? null,
        }),
      });
      const serverMsg = 'data' in res ? res.data : res;
      setMessages((prev) => prev.map((m) => m.client_uuid === msg.client_uuid ? { ...serverMsg, status: 'sent', client_uuid: msg.client_uuid } : m));
      setConversations((prev) => prev.map((c) => c.id === activeConv.id ? { ...c, latest_message: serverMsg, updated_at: serverMsg.created_at } : c));
      loadConversations();
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
      user: { id: currentUserId ?? 0, name: currentUserName, username: (user as any)?.username ?? 'you', avatar_url: currentUserAvatar },
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
        user: { id: currentUserId ?? 0, name: currentUserName, username: (user as any)?.username ?? 'you', avatar_url: currentUserAvatar },
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

  const toggleMessageReaction = async (messageId: number, emoji: string) => {
    try {
      const res = await apiFetch<{ data?: { reactions?: MessageReaction[] } } | { reactions?: MessageReaction[] }>(
        `/messages/${messageId}/reactions`,
        { method: 'POST', body: JSON.stringify({ emoji }) },
      );
      const reactions = res && 'data' in res && res.data
        ? (res.data.reactions ?? [])
        : (res && 'reactions' in res ? (res.reactions ?? []) : []);
      setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, reactions } : m)));
    } catch (e) { console.error('Failed to react to message', e); }
  };

  const copyMessage = async (msg: ChatMessage) => {
    try { await navigator.clipboard.writeText(msg.content ?? ''); } catch (e) { console.error('Failed to copy message', e); }
  };

  const deleteMessage = async (msg: ChatMessage, mode: 'me' | 'everyone') => {
    try {
      await apiFetch(`/conversations/${msg.conversation_id}/messages/${msg.id}`, {
        method: 'DELETE',
        body: JSON.stringify({ mode }),
      });
      setMessages((prev) => prev.filter((m) => m.id !== msg.id && m.client_uuid !== msg.client_uuid));
    } catch (e) { console.error('Failed to delete message', e); }
  };

  const forwardMessage = async (msg: ChatMessage, toConversationId: number) => {
    try {
      await apiFetch(`/messages/${msg.id}/forward`, {
        method: 'POST',
        body: JSON.stringify({ to_conversation_id: toConversationId }),
      });
      setForwardMsg(null);
      loadConversations();
    } catch (e) { console.error('Failed to forward message', e); }
  };

  const filteredConversations = conversations.filter((c) => {
    if (!c) return false;
    if (showSaved) return c.type === 'saved';
    if (c.type === 'saved') return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const title = (c.title || c.other_user?.name || '').toLowerCase();
      const content = (c.latest_message?.content || '').toLowerCase();
      const matched = title.includes(q) || content.includes(q);
      if (!matched) return false;
    }
    switch (filterTab) {
      case 'app':
        return (
          (c.type === 'direct' || c.type === 'app') &&
          !c.has_active_escrow &&
          !c.community &&
          (c.member_count == null || c.member_count <= 2)
        );
      case 'communities':
        return (
          c.type === 'community' ||
          c.type === 'group' ||
          !!c.community ||
          (c.member_count != null && c.member_count > 2)
        );
      case 'marketplace':
        return (
          c.type === 'marketplace' ||
          !!c.has_active_escrow ||
          (c.escrow_amount != null && c.escrow_amount > 0) ||
          /order|deal|product|store|escrow|seller|buyer/i.test(c.title || '')
        );
      case 'spam':
        return !!c.is_muted || c.type === 'spam';
      case 'all':
      default:
        return true;
    }
  });

  return (
    <div className="flex flex-1 min-h-0 w-full overflow-hidden bg-background">
      {/* ── Sidebar ───────────────────────────────────────────────────────── */}
      <aside className={`${activeConv ? 'hidden md:flex' : 'flex'} w-full md:w-[360px] shrink-0 flex-col border-r border-border bg-card relative`}>
        {/* Stories Carousel */}
        <StoriesCarousel
          currentUserName={currentUserName}
          currentUserAvatar={currentUserAvatar}
          unreadMessagesCount={conversations.reduce((acc, c) => acc + (c?.unread_count || 0), 0)}
          stories={storiesList}
          onAddStory={() => setIsCreateStoryOpen(true)}
        />

        <div className="px-3 py-2.5 border-b border-border">
          <div className="relative">
            <Search weight="fill" className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input type="search" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search conversations…" className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg bg-muted border-0 outline-none focus:ring-1 focus:ring-secondary placeholder:text-muted-foreground" />
          </div>
        </div>

        <div className="flex items-center gap-1 px-3 py-2 border-b border-border bg-muted/10 overflow-x-auto no-scrollbar">
          <button
            key="saved"
            onClick={() => setShowSaved((v) => !v)}
            className={`flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded-lg capitalize transition-all shrink-0 ${showSaved ? 'bg-amber-500/20 text-amber-500 border border-amber-500/30' : 'text-muted-foreground hover:bg-muted'}`}
          >
            <Bookmark weight="fill" className="h-3 w-3" />
            Saved
          </button>
          <div className="w-px h-5 bg-border mx-1 shrink-0" />
          {FILTER_TABS.map((tab) => {
            const isRequests = tab.id === 'requests';
            const selected = !isRequests && filterTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  if (tab.id === 'requests') {
                    navigate('/app/friends');
                    return;
                  }
                  setFilterTab(tab.id);
                }}
                className={`flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded-lg capitalize transition-all shrink-0 ${selected ? 'bg-secondary text-secondary-foreground ' : 'text-muted-foreground hover:bg-muted'}`}
              >
                {tab.icon}
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-border/40 pb-16">
          {isLoadingList ? (
            <div className="py-12 text-center space-y-2"><Loader2 weight="fill" className="h-6 w-6 animate-spin text-secondary mx-auto" /><p className="text-xs text-muted-foreground font-medium">Loading conversations…</p></div>
          ) : filteredConversations.length === 0 ? (
            <div className="p-5 text-center space-y-2"><MessageSquare weight="fill" className="h-8 w-8 text-muted-foreground/30 mx-auto" /><p className="text-xs font-bold text-foreground">No conversations found</p></div>
          ) : filteredConversations.map((c) => {
            const isSelected = activeConv?.id === c.id;
            const timeFormatted = safeFormatDistanceToNow(c.latest_message?.created_at, { addSuffix: false });
            const title = c.title || c.other_user?.name || (c.type === 'saved' ? 'Saved Messages' : 'Conversation');
            return (
              <button key={c.id} onClick={() => selectConversation(c)} className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${isSelected ? 'bg-secondary/15 border-l-4 border-secondary' : 'hover:bg-muted/40'}`}>
                {c.type === 'saved' ? <div className="h-9 w-9 rounded-full bg-amber-500/20 text-amber-500 flex items-center justify-center shrink-0"><Bookmark weight="fill" className="h-4 w-4" /></div>
                  : c.type === 'community' ? <div className="h-9 w-9 rounded-full bg-secondary/20 text-secondary flex items-center justify-center shrink-0"><Users weight="fill" className="h-4 w-4" /></div>
                  : <Avatar name={c.other_user?.name ?? title} src={c.other_user?.avatar_url} size={36} />}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground truncate flex items-center gap-1">
                      {c.is_muted && <BellOff weight="fill" className="h-3 w-3 text-muted-foreground shrink-0" />}
                      {title}
                    </span>
                    {timeFormatted && <span className="text-[10px] text-muted-foreground shrink-0 ml-1">{timeFormatted}</span>}
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate mt-0.5">{c.latest_message ? c.latest_message.content : 'No messages yet'}</p>
                </div>
                {c.unread_count > 0 && <span className="h-4 min-w-4 px-1 rounded-full bg-secondary text-secondary-foreground text-[10px] font-extrabold flex items-center justify-center shrink-0 ">{c.unread_count}</span>}
              </button>
            );
          })}
        </div>

        {/* Floating "+ New" Action Pill Button (Image 1) */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20">
          <button
            type="button"
            onClick={() => setIsNewModalOpen(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-extrabold text-xs shadow-xl hover:scale-105 transition-all"
          >
            <Plus weight="fill" className="h-4 w-4" />
            <span>New</span>
          </button>
        </div>
      </aside>

      {/* ── Main Chat Area ─────────────────────────────────────────────────── */}
      <main className={`${activeConv ? 'flex' : 'hidden md:flex'} flex-1 flex-col bg-background`}>
        {activeConv ? (
          <>
            {/* Header */}
            <div className="px-4 py-3 border-b border-border bg-card flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <button onClick={() => setActiveConv(null)} className="md:hidden p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><ArrowLeft weight="fill" className="h-5 w-5" /></button>
                {activeConv.type === 'saved' ? <div className="h-9 w-9 rounded-full bg-amber-500/20 text-amber-500 flex items-center justify-center shrink-0"><Bookmark weight="fill" className="h-4 w-4" /></div>
                  : activeConv.type === 'community' ? <div className="h-9 w-9 rounded-full bg-secondary/20 text-secondary flex items-center justify-center shrink-0"><Users weight="fill" className="h-4 w-4" /></div>
                  : <Avatar name={activeConv.other_user?.name ?? activeConv.title ?? 'Conversation'} src={activeConv.other_user?.avatar_url} size={36} />}
                <div>
                  <h3 className="text-xs sm:text-sm font-extrabold text-foreground flex items-center gap-1.5">
                    {isMuted && <BellOff weight="fill" className="h-3.5 w-3.5 text-muted-foreground" />}
                    {activeConv.title || activeConv.other_user?.name || 'Conversation'}
                  </h3>
                  <span className="text-[10px] text-muted-foreground capitalize">
                    {activeConv.type === 'community' ? 'Community General Channel' : activeConv.type === 'saved' ? 'Personal Notes' : 'Direct Message'}
                  </span>
                </div>
              </div>

              {/* Header action menu */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => { setCallMode('video'); setIsCallModalOpen(true); }}
                  className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  title="Start Video Call"
                >
                  <Video weight="fill" className="h-4.5 w-4.5 text-secondary" />
                </button>
                <div className="relative">
                  <button onClick={() => setShowHeaderMenu((v) => !v)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors"><MoreVertical weight="fill" className="h-4 w-4" /></button>
                  {showHeaderMenu && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowHeaderMenu(false)} role="presentation" onKeyDown={(e) => e.key === 'Enter' && setShowHeaderMenu(false)} />
                      <div className="absolute right-0 top-5 z-50 w-44 rounded-lg border-none bg-card shadow-xl p-1 text-xs space-y-0.5">
                        <button onClick={() => handleToggleSetting('is_muted')} className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-muted text-foreground font-medium">
                          <BellOff weight="fill" className="h-3.5 w-3.5 text-muted-foreground" /> {isMuted ? 'Unmute' : 'Mute'} conversation
                        </button>
                        <button onClick={() => handleToggleSetting('is_archived')} className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-muted text-foreground font-medium">
                          <Archive weight="fill" className="h-3.5 w-3.5 text-muted-foreground" /> {isArchived ? 'Unarchive' : 'Archive'}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Message Stream */}
            <div className="flex-1 overflow-y-auto p-4 space-y-1 bg-muted/10">
              {isLoadingMsgs ? (
                <div className="py-20 text-center space-y-2"><Loader2 weight="fill" className="h-6 w-6 animate-spin text-secondary mx-auto" /><p className="text-xs text-muted-foreground">Loading message history…</p></div>
              ) : messages.length === 0 ? (
                <div className="py-20 text-center space-y-2"><MessageSquare weight="fill" className="h-8 w-8 text-secondary/40 mx-auto" /><p className="text-xs font-bold text-foreground">Start the conversation!</p></div>
              ) : messages.map((msg) => {
                const isMine = msg.user_id === currentUserId;
                const isPending = msg.status === 'pending';
                const isFailed = msg.status === 'failed';

                return (
                  <div key={msg.client_uuid || msg.id} className={`group flex items-end gap-2 ${isMine ? 'justify-end' : 'justify-start'} mb-1`}>
                    {!isMine && <Avatar name={msg.user?.name} src={msg.user?.avatar_url} size={28} />}

                    <div
                      className={`max-w-[75%] sm:max-w-[65%] space-y-1 cursor-default ${dragStartRef.current?.id === msg.id ? 'opacity-80' : ''}`}
                      onPointerDown={(e) => { dragStartRef.current = { id: msg.id, x: e.clientX }; }}
                      onPointerUp={(e) => {
                        const drag = dragStartRef.current;
                        if (drag && drag.id === msg.id) {
                          const dx = e.clientX - drag.x;
                          if (Math.abs(dx) > 60) { drag.dragged = true; setReplyingTo(msg); }
                          dragStartRef.current = null;
                        }
                      }}
                      onPointerLeave={() => { if (dragStartRef.current?.id === msg.id) dragStartRef.current = null; }}
                      onClick={(e) => {
                        if ((e.target as HTMLElement).closest('button')) return;
                        if (dragStartRef.current?.dragged) return;
                        setEmojiMenu({ msg, x: Math.min(e.clientX, window.innerWidth - 150), y: e.clientY });
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setActionMenu({ msg, x: Math.min(e.clientX, window.innerWidth - 190), y: e.clientY });
                      }}
                    >
                      {/* Reply context */}
                      {msg.reply_to && (
                        <div className={`px-2.5 py-1.5 rounded-lg text-[10px] border-l-2 border-secondary bg-secondary/10 text-muted-foreground ${isMine ? 'ml-auto' : ''}`}>
                          <span className="font-bold text-secondary">{msg.reply_to.user?.name ?? 'User'}</span>
                          <p className="truncate">{msg.reply_to.content?.slice(0, 60)}</p>
                        </div>
                      )}

                      <div className={`p-3 rounded-lg text-xs space-y-1 ${isMine ? (isFailed ? 'bg-destructive/15 border border-destructive/40 text-foreground rounded-br-none' : isPending ? 'bg-secondary/70 text-secondary-foreground rounded-br-none opacity-85 ' : 'bg-secondary text-secondary-foreground rounded-br-none ') : 'bg-card border-none text-foreground rounded-bl-none '}`}>
                        {!isMine && msg.user?.name && <span className="block text-[10px] font-bold text-secondary">{msg.user.name}</span>}

                        {/* Attachment */}
                        {msg.attachment_url && (
                          msg.attachment_type === 'image'
                            ? <img src={msg.attachment_url} alt="attachment" className="max-w-full rounded-lg max-h-48 object-cover mb-1" />
                            : <a href={msg.attachment_url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-xs font-semibold underline"><Paperclip weight="fill" className="h-3.5 w-3.5" /> Attachment</a>
                        )}

                        <p className="leading-relaxed whitespace-pre-wrap break-words font-normal">{msg.content}</p>

                        <div className="flex items-center justify-end gap-1 text-[9px] opacity-80 pt-0.5">
                          <span>{safeFormat(msg.created_at, 'h:mm a')}</span>
                          {isMine && (isPending ? <Loader2 weight="fill" className="h-2.5 w-2.5 animate-spin" /> : isFailed ? <AlertCircle weight="fill" className="h-2.5 w-2.5 text-destructive" /> : <CheckCheck weight="fill" className="h-2.5 w-2.5" />)}
                        </div>

                        {isFailed && (
                          <button onClick={() => executeSendMessage(msg)} className="mt-1 flex items-center gap-1 text-[10px] font-extrabold text-destructive hover:underline">
                            <RotateCcw weight="fill" className="h-3 w-3" /> Retry sending
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

                    {/* Action buttons (show on hover) */}
                    <button
                      onClick={() => setReplyingTo(msg)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground shrink-0 mb-1"
                      title="Reply"
                    >
                      <Reply weight="fill" className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={(e) => {
                        const r = e.currentTarget.getBoundingClientRect();
                        const x = isMine ? r.left - 172 : r.right + 8;
                        setActionMenu({ msg, x: Math.max(4, Math.min(x, window.innerWidth - 190)), y: r.top });
                      }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground shrink-0 mb-1"
                      title="More actions"
                      aria-label="More actions"
                    >
                      <MoreVertical weight="fill" className="h-3.5 w-3.5" />
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
            <form onSubmit={handleSendMessage} className="p-3 border-t border-border bg-card flex items-center gap-2 shrink-0">
              {/* Attachment button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0 disabled:opacity-50"
                title="Attach file"
              >
                {uploading ? <Loader2 weight="fill" className="h-4 w-4 animate-spin" /> : <Paperclip weight="fill" className="h-4 w-4" />}
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
                placeholder={`Message ${activeConv.title || activeConv.other_user?.name || '…'}…`}
                className="flex-1 px-4 py-2.5 text-xs rounded-lg bg-muted border-0 outline-none focus:ring-1 focus:ring-secondary placeholder:text-muted-foreground"
              />
              <button type="submit" disabled={!inputContent.trim() || uploading} className="p-2.5 rounded-lg bg-secondary text-secondary-foreground font-bold hover:bg-secondary/90 disabled:opacity-50 transition-all shrink-0 ">
                <Send weight="fill" className="h-4 w-4" />
              </button>
            </form>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center px-6">
            <div className="rounded-lg bg-secondary/10 p-5 text-secondary border border-secondary/20"><MessageSquare weight="fill" className="h-10 w-10" /></div>
            <div className="space-y-1">
              <h3 className="text-base font-extrabold text-foreground">Your Messages Hub</h3>
              <p className="text-xs text-muted-foreground max-w-sm">Select a conversation or open Saved Messages to start chatting.</p>
            </div>
          </div>
        )}
      </main>

      {/* ── Modals & Overlays ─────────────────────────────────────────────── */}
      <NewChatModal
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
        onSelectAction={(act) => {
          if (act === 'chat') {
            openSavedMessages();
          } else if (act === 'community') {
            navigate('/app/communities');
          } else {
            navigate('/app/friends');
          }
        }}
      />

      <CallOverlayModal
        isOpen={isCallModalOpen}
        callMode={callMode}
        callerName={activeConv?.title ?? 'Unknown contact'}
        callerAvatar={activeConv?.other_user?.avatar_url}
        onClose={() => setIsCallModalOpen(false)}
        onOpenChat={() => setIsCallModalOpen(false)}
      />

      <StoryCreateModal
        isOpen={isCreateStoryOpen}
        onClose={() => setIsCreateStoryOpen(false)}
      />

      {/* Click-to-react emoji bubble */}
      {emojiMenu && (
        <div className="fixed inset-0 z-50" onClick={() => setEmojiMenu(null)} role="presentation" onKeyDown={(e) => e.key === 'Enter' && setEmojiMenu(null)} />
      )}
      {emojiMenu && (
        <div
          className="fixed z-50 flex items-center gap-1 p-1.5 rounded-xl bg-card shadow-xl border border-border animate-in fade-in zoom-in-95"
          style={{ left: emojiMenu.x, top: Math.max(8, emojiMenu.y - 52) }}
        >
          {QUICK_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => { if (!emojiMenu.msg.id) return; toggleMessageReaction(emojiMenu.msg.id, emoji); setEmojiMenu(null); }}
              className="text-lg h-9 w-9 flex items-center justify-center rounded-lg hover:bg-muted transition-colors"
              title={`React ${emoji}`}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {/* Right-click / more actions menu */}
      {actionMenu && (
        <div className="fixed inset-0 z-50" onClick={() => setActionMenu(null)} role="presentation" onKeyDown={(e) => e.key === 'Enter' && setActionMenu(null)} />
      )}
      {actionMenu && (
        <div
          className="fixed z-50 w-52 rounded-xl bg-card shadow-xl border border-border p-1.5 animate-in fade-in zoom-in-95"
          style={{ left: actionMenu.x, top: Math.max(8, actionMenu.y - 40) }}
        >
          <div className="flex items-center justify-around gap-1 p-1 mb-1 border-b border-border">
            {QUICK_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => { if (!actionMenu.msg.id) return; toggleMessageReaction(actionMenu.msg.id, emoji); setActionMenu(null); }}
                className="text-base h-8 w-8 flex items-center justify-center rounded-lg hover:bg-muted transition-colors"
              >
                {emoji}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => { setReplyingTo(actionMenu.msg); setActionMenu(null); }}
            className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-bold text-foreground hover:bg-muted transition-colors"
          >
            <Reply weight="fill" className="h-4 w-4" /> Reply
          </button>
          <button
            type="button"
            onClick={() => { setForwardMsg(actionMenu.msg); setActionMenu(null); }}
            className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-bold text-foreground hover:bg-muted transition-colors"
          >
            <Send weight="fill" className="h-4 w-4" /> Forward
          </button>
          <button
            type="button"
            onClick={() => { copyMessage(actionMenu.msg); setActionMenu(null); }}
            className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-bold text-foreground hover:bg-muted transition-colors"
          >
            <Copy className="h-4 w-4" /> Copy
          </button>
          <button
            type="button"
            onClick={() => { setActionMenu(null); setPendingDelete(actionMenu.msg); }}
            className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-bold text-red-500 hover:bg-red-500/10 transition-colors"
          >
            <Trash className="h-4 w-4" /> Delete
          </button>
        </div>
      )}

      {/* Delete confirmation */}
      {pendingDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/40" onClick={() => setPendingDelete(null)} role="presentation" />
          <div className="relative w-full max-w-sm rounded-xl bg-card shadow-xl p-4">
            <h3 className="text-sm font-extrabold text-foreground mb-1">Delete message</h3>
            <p className="text-xs text-muted-foreground mb-4">
              {pendingDelete.user_id === currentUserId
                ? 'Delete this message for yourself or for everyone?'
                : 'Remove this message from your view?'}
            </p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => { deleteMessage(pendingDelete, 'me'); setPendingDelete(null); }}
                className="w-full px-3 py-2 rounded-lg bg-foreground text-background text-xs font-extrabold hover:opacity-90 transition-opacity"
              >
                Delete for me
              </button>
              {pendingDelete.user_id === currentUserId && (
                <button
                  type="button"
                  onClick={() => { deleteMessage(pendingDelete, 'everyone'); setPendingDelete(null); }}
                  className="w-full px-3 py-2 rounded-lg bg-red-500/10 text-red-500 text-xs font-extrabold hover:bg-red-500/20 transition-colors"
                >
                  Delete for everyone
                </button>
              )}
              <button
                type="button"
                onClick={() => setPendingDelete(null)}
                className="w-full px-3 py-2 rounded-lg text-xs font-bold text-muted-foreground hover:bg-muted transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Forward picker */}
      {forwardMsg && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/40" onClick={() => setForwardMsg(null)} role="presentation" />
          <div className="relative w-full max-w-md rounded-xl bg-card shadow-xl p-4 max-h-[75vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-extrabold text-foreground">Forward message</h3>
              <button type="button" onClick={() => setForwardMsg(null)} className="p-1 rounded-lg hover:bg-muted text-muted-foreground" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="overflow-y-auto divide-y divide-border/40">
              {conversations.filter((c) => c.id !== activeConv?.id && c.type !== 'saved').length === 0 ? (
                <p className="py-8 text-center text-xs text-muted-foreground">No other conversations to forward to.</p>
              ) : conversations.filter((c) => c.id !== activeConv?.id && c.type !== 'saved').map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => forwardMessage(forwardMsg, c.id)}
                  className="w-full flex items-center gap-3 px-2 py-2.5 text-left hover:bg-muted transition-colors"
                >
                  {c.type === 'community' ? (
                    <div className="h-8 w-8 rounded-full bg-secondary/20 text-secondary flex items-center justify-center shrink-0">
                      <Users weight="fill" className="h-3.5 w-3.5" />
                    </div>
                  ) : (
                    <Avatar name={c.other_user?.name ?? c.title} src={c.other_user?.avatar_url} size={32} />
                  )}
                  <span className="text-xs font-bold text-foreground truncate">{c.title || c.other_user?.name || 'Conversation'}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
