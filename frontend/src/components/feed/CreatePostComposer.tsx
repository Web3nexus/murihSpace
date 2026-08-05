import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  MessageSquare,
  Megaphone,
  ImageIcon,
  Link2,
  Send,
  X,
} from 'lucide-react';
import type { CreatePostPayload, PostType } from '@/types/post';

interface CreatePostComposerProps {
  communityId: number;
  onPost: (payload: CreatePostPayload) => Promise<void>;
  placeholder?: string;
  currentUserName?: string;
  currentUserAvatar?: string;
  isCreator?: boolean;
}

const POST_TYPES: { value: PostType; label: string; icon: React.ReactNode; color: string }[] = [
  { value: 'status', label: 'Status', icon: <MessageSquare size={14} />, color: '#2164b6' },
  { value: 'announcement', label: 'Announcement', icon: <Megaphone size={14} />, color: '#F59E0B' },
  { value: 'media', label: 'Media', icon: <ImageIcon size={14} />, color: '#8B5CF6' },
];

export default function CreatePostComposer({
  communityId,
  onPost,
  placeholder = "Share something with the community…",
  currentUserName,
  currentUserAvatar,
  isCreator = false,
}: CreatePostComposerProps) {
  const [content, setContent] = useState('');
  const [type, setType] = useState<PostType>('status');
  const [linkUrl, setLinkUrl] = useState('');
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const charLimit = 2000;
  const remaining = charLimit - content.length;

  const handleSubmit = async () => {
    if (!content.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onPost({
        community_id: communityId,
        type,
        content: content.trim(),
        ...(linkUrl.trim() && { link_url: linkUrl.trim() }),
      });
      setContent('');
      setLinkUrl('');
      setShowLinkInput(false);
      setType('status');
      setIsFocused(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleSubmit();
    }
  };

  const initials = currentUserName
    ? currentUserName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : 'U';

  return (
    <div className="composer-card">
      <div className="composer-inner">
        {/* Avatar */}
        <div className="composer-avatar">
          {currentUserAvatar ? (
            <img src={currentUserAvatar} alt={currentUserName} />
          ) : (
            <span>{initials}</span>
          )}
        </div>

        {/* Input area */}
        <div className="composer-body">
          {/* Post type selector */}
          {(isFocused || content.length > 0) && (
            <div className="composer-type-tabs">
              {POST_TYPES.filter(t => t.value !== 'announcement' || isCreator).map((t) => (
                <button
                  key={t.value}
                  className={`composer-type-tab ${type === t.value ? 'active' : ''}`}
                  style={{ '--tab-color': t.color } as React.CSSProperties}
                  onClick={() => setType(t.value)}
                >
                  {t.icon}
                  {t.label}
                </button>
              ))}
            </div>
          )}

          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="composer-textarea"
            maxLength={charLimit}
            rows={isFocused || content.length > 0 ? 4 : 2}
          />

          {/* Link input */}
          {showLinkInput && (
            <div className="composer-link-row">
              <Link2 size={14} className="composer-link-icon" />
              <input
                type="url"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://…"
                className="composer-link-input"
              />
              <button onClick={() => { setShowLinkInput(false); setLinkUrl(''); }} className="composer-link-close">
                <X size={14} />
              </button>
            </div>
          )}

          {/* Toolbar */}
          {(isFocused || content.length > 0) && (
            <div className="composer-toolbar">
              <div className="composer-toolbar-left">
                <button
                  className={`composer-tool-btn ${showLinkInput ? 'active' : ''}`}
                  onClick={() => setShowLinkInput((v) => !v)}
                  title="Attach link"
                >
                  <Link2 size={16} />
                </button>
              </div>

              <div className="composer-toolbar-right">
                <span className={`composer-char-count ${remaining < 100 ? 'warn' : ''}`}>
                  {remaining}
                </span>
                <Button
                  onClick={handleSubmit}
                  disabled={!content.trim() || isSubmitting || remaining < 0}
                  className="composer-submit-btn"
                  size="sm"
                >
                  {isSubmitting ? (
                    <span className="composer-spinner" />
                  ) : (
                    <>
                      <Send size={14} />
                      Post
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
