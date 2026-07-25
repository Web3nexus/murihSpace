import { useState } from 'react';
import type { MessageReaction } from '@/types/chat';

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥'];

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api/v1';

interface MessageReactionsProps {
  messageId: number;
  reactions: MessageReaction[];
  onReactionToggle: (messageId: number, updated: MessageReaction[]) => void;
}

export function MessageReactions({ messageId, reactions, onReactionToggle }: MessageReactionsProps) {
  const [showPicker, setShowPicker] = useState(false);

  const handleReact = async (emoji: string) => {
    const token = localStorage.getItem('murihspace-token');
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
        onReactionToggle(messageId, json.reactions ?? []);
      }
    } catch (e) { console.error('Failed to add reaction', e); }
  };

  return (
    <div className="flex items-center gap-1 flex-wrap relative group">
      {/* Existing reactions */}
      {reactions.map((r) => (
        <button
          key={r.emoji}
          onClick={() => handleReact(r.emoji)}
          title={`${r.count} reaction${r.count !== 1 ? 's' : ''}`}
          className={`px-2 py-0.5 rounded-full text-xs border transition-all ${
            r.by_me
              ? 'bg-secondary/20 border-secondary/50 text-secondary font-bold'
              : 'bg-muted/60 border-border text-foreground hover:border-secondary/40'
          }`}
        >
          <span>{r.emoji}</span>
          <span className="ml-1 text-[10px] font-bold">{r.count}</span>
        </button>
      ))}

      {/* Add reaction trigger */}
      <div className="relative">
        <button
          onClick={() => setShowPicker((v) => !v)}
          className="opacity-0 group-hover:opacity-100 transition-opacity px-1.5 py-0.5 rounded-full text-xs border border-dashed border-border text-muted-foreground hover:border-secondary/50 hover:text-secondary"
          title="React"
        >
          +😊
        </button>

        {showPicker && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowPicker(false)} role="presentation" onKeyDown={(e) => e.key === 'Enter' && setShowPicker(false)} />
            <div className="absolute bottom-7 left-0 z-50 flex gap-1 p-1.5 rounded-xl border border-border bg-card shadow-xl">
              {QUICK_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => handleReact(emoji)}
                  className="text-base w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted transition-colors"
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
}
