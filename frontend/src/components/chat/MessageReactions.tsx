import { useState } from 'react';
import type { MessageReaction } from '@/types/chat';
import { getAuthToken } from "@/lib/auth/token";
import { BubbleReactions } from '@/components/ui/bubble';
import { cn } from '@/lib/utils';

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥'];

const API_BASE = (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL) ?? 'http://localhost:8000/api/v1';

interface MessageReactionsProps {
  messageId: number;
  reactions: MessageReaction[];
  onReactionToggle: (messageId: number, updated: MessageReaction[]) => void;
  align?: 'start' | 'end';
  useBubbleReactions?: boolean;
}

export function MessageReactions({
  messageId,
  reactions,
  onReactionToggle,
  align = 'end',
  useBubbleReactions = false,
}: MessageReactionsProps) {
  const [showPicker, setShowPicker] = useState(false);

  const handleReact = async (emoji: string) => {
    const token = getAuthToken();
    setShowPicker(false);

    try {
      const res = await fetch(`${API_BASE}/messages/${messageId}/reactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ emoji }),
      });
      if (res.ok) {
        const json = await res.json();
        onReactionToggle(messageId, json?.data?.reactions ?? json?.reactions ?? []);
      }
    } catch (e) {
      console.error('Failed to add reaction', e);
    }
  };

  const reactionContent = (
    <div className="flex items-center gap-1 flex-wrap relative group">
      {/* Existing reactions */}
      {reactions.map((r) => (
        <button
          key={r.emoji}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleReact(r.emoji);
          }}
          title={`${r.count} reaction${r.count !== 1 ? 's' : ''}`}
          className={cn(
            'inline-flex items-center px-1.5 py-0.5 rounded-full text-xs border transition-all cursor-pointer select-none',
            r.by_me
              ? 'bg-secondary/25 border-secondary/50 text-secondary font-bold shadow-2xs'
              : 'bg-muted/80 border-border/70 text-foreground hover:border-secondary/40 hover:bg-muted'
          )}
        >
          <span>{r.emoji}</span>
          <span className="ml-1 text-[10px] font-bold">{r.count}</span>
        </button>
      ))}

      {/* Add reaction trigger */}
      <div className="relative">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setShowPicker((v) => !v);
          }}
          className={cn(
            'transition-opacity px-1.5 py-0.5 rounded-full text-xs border border-dashed border-border text-muted-foreground hover:border-secondary/50 hover:text-secondary',
            reactions.length > 0 ? 'opacity-0 group-hover:opacity-100' : 'opacity-70 hover:opacity-100'
          )}
          title="React"
        >
          +😊
        </button>

        {showPicker && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={(e) => {
                e.stopPropagation();
                setShowPicker(false);
              }}
              role="presentation"
            />
            <div
              className="absolute bottom-7 left-0 z-50 flex gap-1 p-1.5 rounded-lg border border-border/80 bg-popover text-popover-foreground shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              {QUICK_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleReact(emoji);
                  }}
                  className="text-base w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted transition-colors cursor-pointer"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );

  if (useBubbleReactions && reactions.length > 0) {
    return (
      <BubbleReactions align={align} side="bottom" className="shadow-xs bg-background/90 backdrop-blur-xs border border-border/60">
        {reactionContent}
      </BubbleReactions>
    );
  }

  return reactionContent;
}
