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
  onMessageRead?: (data: { conversation_id: number; reader_id: number; read_at: string }) => void;
  onMessageDelivered?: (data: { conversation_id: number; message_ids: number[]; delivered_at: string }) => void;
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

    const handleRead = (e: { conversation_id: number; reader_id: number; read_at: string }) => {
      eventsRef.current.onMessageRead?.(e);
    };

    const handleDelivered = (e: { conversation_id: number; message_ids: number[]; delivered_at: string }) => {
      eventsRef.current.onMessageDelivered?.(e);
    };

    channel.listen('.MessageSent', handleMessage);
    channel.listen('.typing', handleTyping);
    channel.listen('.MessageReacted', handleReaction);
    channel.listen('.MessageRead', handleRead);
    channel.listen('.MessageDelivered', handleDelivered);

    cleanup.current = () => {
      channel.stopListening('.MessageSent', handleMessage);
      channel.stopListening('.typing', handleTyping);
      channel.stopListening('.MessageReacted', handleReaction);
      channel.stopListening('.MessageRead', handleRead);
      channel.stopListening('.MessageDelivered', handleDelivered);
      echo.leave(channelName);
    };

    return () => {
      cleanup.current?.();
      cleanup.current = null;
    };
  }, [conversationId, currentUserId]);
}
