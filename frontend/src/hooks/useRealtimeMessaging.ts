import { useEffect, useRef } from 'react';
import type { ChatMessage, MessageReaction } from '@/types/chat';
import { getEcho } from '@/lib/echo';

export interface RealtimeEvents {
  onMessageReceived: (message: ChatMessage) => void;
  onTyping: (data: { user_id: number; user_name: string; is_typing: boolean }) => void;
  onReaction: (data: {
    message_id: number;
    conversation_id: number;
    user_id: number;
    emoji: string;
    action: 'added' | 'removed';
    reactions: MessageReaction[];
  }) => void;
}

export function useRealtimeMessaging(
  conversationId: number | null,
  currentUserId: number | undefined,
  events: RealtimeEvents,
) {
  const eventsRef = useRef(events);
  const userIdRef = useRef(currentUserId);

  useEffect(() => {
    eventsRef.current = events;
  }, [events]);

  useEffect(() => {
    userIdRef.current = currentUserId;
  }, [currentUserId]);

  const cleanup = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!conversationId || !currentUserId) return;

    const channelName = `conversation.${conversationId}`;

    let echo: ReturnType<typeof getEcho>;
    try {
      echo = getEcho();
    } catch {
      return;
    }

    const channel = echo.private(channelName);

    const handleMessage = (e: ChatMessage) => {
      if (e.user_id === userIdRef.current) return;
      eventsRef.current.onMessageReceived(e);
    };

    const handleTyping = (e: { user_id: number; user_name: string; is_typing: boolean }) => {
      if (e.user_id === userIdRef.current) return;
      eventsRef.current.onTyping(e);
    };

    const handleReaction = (e: {
      message_id: number;
      conversation_id: number;
      user_id: number;
      emoji: string;
      action: 'added' | 'removed';
      reactions: MessageReaction[];
    }) => {
      eventsRef.current.onReaction(e);
    };

    channel.listen('.MessageSent', handleMessage);
    channel.listen('.typing', handleTyping);
    channel.listen('.MessageReacted', handleReaction);

    cleanup.current = () => {
      channel.stopListening('.MessageSent', handleMessage);
      channel.stopListening('.typing', handleTyping);
      channel.stopListening('.MessageReacted', handleReaction);
      echo.leave(channelName);
    };

    return () => {
      cleanup.current?.();
      cleanup.current = null;
    };
  }, [conversationId, currentUserId]);
}
