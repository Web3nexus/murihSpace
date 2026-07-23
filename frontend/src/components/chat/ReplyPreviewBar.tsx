import { X, Reply } from 'lucide-react';
import type { ChatMessage } from '@/types/chat';

interface ReplyPreviewBarProps {
  replyingTo: ChatMessage;
  onDismiss: () => void;
}

export function ReplyPreviewBar({ replyingTo, onDismiss }: ReplyPreviewBarProps) {
  const senderName = replyingTo.user?.name ?? 'Unknown';
  const preview = replyingTo.attachment_type
    ? replyingTo.attachment_type === 'image'
      ? '📷 Image'
      : replyingTo.attachment_type === 'file'
      ? '📎 File'
      : '🎙 Voice note'
    : (replyingTo.content?.slice(0, 80) ?? '');

  return (
    <div className="mx-3 mb-1 px-3 py-2 rounded-xl bg-secondary/10 border border-secondary/25 flex items-center gap-3">
      <Reply className="h-4 w-4 text-secondary shrink-0" />
      <div className="flex-1 min-w-0">
        <span className="text-[11px] font-extrabold text-secondary">{senderName}</span>
        <p className="text-[11px] text-muted-foreground truncate">{preview}</p>
      </div>
      <button
        onClick={onDismiss}
        className="p-1 rounded-lg hover:bg-secondary/20 text-muted-foreground hover:text-foreground transition-colors shrink-0"
        title="Cancel reply"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
