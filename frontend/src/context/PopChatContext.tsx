import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { apiClient } from "@/lib/api/client";
import type { ConversationItem } from "@/types/chat";

interface PopChatRecipient {
  id: number;
  name: string;
  avatar?: string;
  username?: string;
}

interface PopChatContextType {
  isOpen: boolean;
  isMinimized: boolean;
  activeConv: ConversationItem | null;
  activeRecipient: PopChatRecipient | null;
  conversations: ConversationItem[];
  unreadCount: number;
  openPopChat: (conv?: ConversationItem | null, recipient?: PopChatRecipient | null) => void;
  closePopChat: () => void;
  toggleMinimize: () => void;
  selectConversation: (conv: ConversationItem) => void;
  refreshConversations: () => Promise<void>;
  startDirectChat: (targetUserId: number, recipientInfo?: PopChatRecipient) => Promise<void>;
  backToList: () => void;
}

const PopChatContext = createContext<PopChatContextType | undefined>(undefined);

export function PopChatProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [activeConv, setActiveConv] = useState<ConversationItem | null>(null);
  const [activeRecipient, setActiveRecipient] = useState<PopChatRecipient | null>(null);
  const [conversations, setConversations] = useState<ConversationItem[]>([]);

  const refreshConversations = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const res = await apiClient.get<{ data: ConversationItem[] }>("/conversations");
      const body = res.data as unknown;
      const list = body && typeof body === 'object' && 'data' in (body as any)
        ? (body as any).data
        : Array.isArray(body) ? body : [];
      setConversations(Array.isArray(list) ? list : []);
    } catch {
      // Silent error in background
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      refreshConversations();
      // Poll conversations unread counts periodically every 25 seconds
      const timer = setInterval(refreshConversations, 25000);
      return () => clearInterval(timer);
    } else {
      setConversations([]);
      setIsOpen(false);
    }
  }, [isAuthenticated, refreshConversations]);

  const unreadCount = conversations.reduce((acc, c) => acc + (c.unread_count || 0), 0);

  const openPopChat = useCallback((conv?: ConversationItem | null, recipient?: PopChatRecipient | null) => {
    setIsOpen(true);
    setIsMinimized(false);
    if (conv) {
      setActiveConv(conv);
    }
    if (recipient) {
      setActiveRecipient(recipient);
    }
  }, []);

  const closePopChat = useCallback(() => {
    setIsOpen(false);
    setIsMinimized(false);
  }, []);

  const toggleMinimize = useCallback(() => {
    setIsMinimized((prev) => !prev);
  }, []);

  const selectConversation = useCallback((conv: ConversationItem) => {
    setActiveConv(conv);
    setActiveRecipient({
      id: conv.id,
      name: conv.title,
      avatar: conv.other_user?.avatar_url || conv.community?.logo_url || (conv as any).avatar_url,
    });
    setIsMinimized(false);
  }, []);

  const backToList = useCallback(() => {
    setActiveConv(null);
    setActiveRecipient(null);
  }, []);

  const startDirectChat = useCallback(async (targetUserId: number, recipientInfo?: PopChatRecipient) => {
    try {
      setIsOpen(true);
      setIsMinimized(false);
      if (recipientInfo) {
        setActiveRecipient(recipientInfo);
      }

      // Check if conversation already exists locally
      const existing = conversations.find(
        (c) =>
          c.type === "direct" &&
          (c.other_user?.id === targetUserId ||
            ((c as any).participants && Array.isArray((c as any).participants) && (c as any).participants.some((p: any) => p.id === targetUserId)))
      );
      if (existing) {
        setActiveConv(existing);
        return;
      }

      // Start direct chat with server
      const res = await apiClient.post("/conversations/direct", { user_id: targetUserId });
      const conv = (res.data?.data as ConversationItem) ?? (res.data as ConversationItem);
      if (conv && conv.id) {
        setActiveConv(conv);
        setConversations((prev) => [conv, ...prev.filter((c) => c.id !== conv.id)]);
      }
    } catch (err) {
      console.error("Failed to start direct conversation", err);
    }
  }, [conversations]);

  return (
    <PopChatContext.Provider
      value={{
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
        startDirectChat,
        backToList,
      }}
    >
      {children}
    </PopChatContext.Provider>
  );
}

export function usePopChat() {
  const context = useContext(PopChatContext);
  if (!context) {
    throw new Error("usePopChat must be used within a PopChatProvider");
  }
  return context;
}

