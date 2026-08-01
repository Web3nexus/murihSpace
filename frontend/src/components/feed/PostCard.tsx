import React, { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { MessageSquare, Link2, MoreHorizontal, Pin, PinOff, Megaphone, Heart, Zap, ThumbsUp, HandMetal, ShieldAlert, UserX, BadgeCheck } from 'lucide-react';
import type { Post, ReactionType } from '@/types/post';
import { ReportModal } from '@/components/moderation/ReportModal';
import type { ReportedType } from '@/types/moderation';

interface PostCardProps {
  post: Post;
  onReact?: (postId: number, type: ReactionType) => Promise<void>;
  onComment?: (postId: number, content: string) => Promise<void>;
  onPin?: (postId: number) => Promise<void>;
  onUnpin?: (postId: number) => Promise<void>;
  isModerator?: boolean;
  showCommunity?: boolean;
}

const REACTIONS: { type: ReactionType; emoji: string; icon: React.ReactNode; label: string }[] = [
  { type: 'like', emoji: '👍', icon: <ThumbsUp size={13} />, label: 'Like' },
  { type: 'heart', emoji: '❤️', icon: <Heart size={13} />, label: 'Love' },
  { type: 'fire', emoji: '🔥', icon: <Zap size={13} />, label: 'Fire' },
  { type: 'clap', emoji: '👏', icon: <HandMetal size={13} />, label: 'Clap' },
];

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  announcement: { label: 'Announcement', color: '#F59E0B' },
  media: { label: 'Media', color: '#8B5CF6' },
  status: { label: '', color: '' },
};

function Avatar({ name, src, size = 36 }: { name?: string; src?: string; size?: number }) {
  const initials = name
    ? name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
      />
    );
  }

  return (
    <div
      className="post-card-avatar-fallback"
      style={{ width: size, height: size, fontSize: size * 0.35 }}
    >
      {initials}
    </div>
  );
}

export default function PostCard({ post, onReact, onComment, onPin, onUnpin, isModerator, showCommunity = false }: PostCardProps) {
  const [showCommentBox, setShowCommentBox] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [isCommenting, setIsCommenting] = useState(false);
  const [reactingType, setReactingType] = useState<ReactionType | null>(null);
  const [showReactions, setShowReactions] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [reportTarget, setReportTarget] = useState<{ type: ReportedType; id: number; name?: string } | null>(null);

  const typeLabel = TYPE_LABELS[post.type];
  const timeAgo = formatDistanceToNow(new Date(post.created_at), { addSuffix: true });

  const handleReact = async (type: ReactionType) => {
    if (!onReact || reactingType) return;
    setReactingType(type);
    setShowReactions(false);
    try {
      await onReact(post.id, type);
    } finally {
      setReactingType(null);
    }
  };

  const handleComment = async () => {
    if (!onComment || !commentText.trim() || isCommenting) return;
    setIsCommenting(true);
    try {
      await onComment(post.id, commentText.trim());
      setCommentText('');
      setShowCommentBox(false);
    } finally {
      setIsCommenting(false);
    }
  };

  const totalReactions = post.reactions_count ?? 0;

  return (
    <article className={`post-card ${post.is_pinned ? 'pinned' : ''} ${post.type}`}>
      {/* Pinned banner */}
      {post.is_pinned && (
        <div className="post-card-pinned-banner">
          <Pin size={12} />
          Pinned post
        </div>
      )}

      {/* Announcement label */}
      {typeLabel.label && (
        <div className="post-card-type-label" style={{ '--label-color': typeLabel.color } as React.CSSProperties}>
          <Megaphone size={12} />
          {typeLabel.label}
        </div>
      )}

      <div className="post-card-body">
        {/* Header */}
        <div className="post-card-header">
          <Avatar name={post.author?.name} src={post.author?.avatar_url} />
          <div className="post-card-meta">
            <span className="post-card-author">
              {post.author?.name ?? 'Unknown'}
              {post.author?.has_active_verification_badge && (
                <BadgeCheck size={14} className="inline-block ml-1 text-sky-500 -mt-0.5" aria-label="Verified" />
              )}
            </span>
            {post.author?.username && (
              <span className="post-card-username">@{post.author.username}</span>
            )}
            {showCommunity && post.community && (
              <>
                <span className="post-card-in">in</span>
                <span className="post-card-community">{post.community.name}</span>
              </>
            )}
            <span className="post-card-time">{timeAgo}</span>
          </div>
          <div className="relative">
            <button
              className="post-card-more-btn"
              onClick={() => setShowMenu((v) => !v)}
              title="More options"
            >
              <MoreHorizontal size={16} />
            </button>
            {showMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} role="presentation" onKeyDown={(e) => e.key === 'Enter' && setShowMenu(false)} />
                <div className="absolute right-0 mt-1 w-44 rounded-xl border border-border bg-card shadow-xl z-50 p-1 space-y-0.5 text-xs">
                  {isModerator && (
                    <>
                      {post.is_pinned ? (
                        <button
                          onClick={() => { setShowMenu(false); onUnpin?.(post.id); }}
                          className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-muted text-foreground font-medium flex items-center gap-2"
                        >
                          <PinOff size={14} />
                          Unpin post
                        </button>
                      ) : (
                        <button
                          onClick={() => { setShowMenu(false); onPin?.(post.id); }}
                          className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-muted text-foreground font-medium flex items-center gap-2"
                        >
                          <Pin size={14} />
                          Pin post
                        </button>
                      )}
                    </>
                  )}
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      setReportTarget({ type: 'post', id: post.id, name: 'Post' });
                    }}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-destructive/10 text-destructive font-semibold flex items-center gap-2"
                  >
                    <ShieldAlert size={14} />
                    Report Post
                  </button>
                  {post.author?.id && (
                    <button
                      onClick={() => {
                        setShowMenu(false);
                        setReportTarget({ type: 'user', id: post.author!.id, name: post.author?.name });
                      }}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-muted text-foreground font-medium flex items-center gap-2"
                    >
                      <UserX size={14} />
                      Report Author
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Report Modal */}
        {reportTarget && (
          <ReportModal
            isOpen={!!reportTarget}
            onClose={() => setReportTarget(null)}
            reportedType={reportTarget.type}
            reportedId={reportTarget.id}
            targetName={reportTarget.name}
          />
        )}

        {/* Content */}
        <div className="post-card-content">
          <p>{post.content}</p>
        </div>

        {/* Link preview */}
        {post.link_url && (
          <a
            href={post.link_url}
            target="_blank"
            rel="noopener noreferrer"
            className="post-card-link-preview"
          >
            <Link2 size={13} />
            <span>{post.link_title ?? post.link_url}</span>
          </a>
        )}

        {/* Reaction bar */}
        <div className="post-card-footer">
          <div className="post-card-actions">
            {/* React button with popover */}
            <div className="post-card-react-wrap" onMouseLeave={() => setShowReactions(false)}>
              <button
                className={`post-card-action-btn react ${post.user_reaction ? 'reacted' : ''}`}
                onMouseEnter={() => setShowReactions(true)}
                onClick={() => handleReact(post.user_reaction === 'like' ? 'like' : 'like')}
              >
                {post.user_reaction
                  ? REACTIONS.find(r => r.type === post.user_reaction)?.emoji ?? '👍'
                  : '👍'}
                {totalReactions > 0 && <span>{totalReactions}</span>}
              </button>

              {showReactions && (
                <div className="post-card-reaction-picker">
                  {REACTIONS.map((r) => (
                    <button
                      key={r.type}
                      onClick={() => handleReact(r.type)}
                      className={`reaction-pick-btn ${post.user_reaction === r.type ? 'active' : ''}`}
                      title={r.label}
                    >
                      {r.emoji}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Comment button */}
            <button
              className="post-card-action-btn comment"
              onClick={() => setShowCommentBox((v) => !v)}
            >
              <MessageSquare size={14} />
              {(post.comments_count ?? 0) > 0 && <span>{post.comments_count}</span>}
              Comment
            </button>
          </div>
        </div>

        {/* Comment box */}
        {showCommentBox && (
          <div className="post-card-comment-box">
            <textarea
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Write a comment…"
              className="post-card-comment-input"
              rows={2}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleComment();
              }}
            />
            <div className="post-card-comment-actions">
              <button
                onClick={() => { setShowCommentBox(false); setCommentText(''); }}
                className="post-card-comment-cancel"
              >
                Cancel
              </button>
              <button
                onClick={handleComment}
                disabled={!commentText.trim() || isCommenting}
                className="post-card-comment-submit"
              >
                {isCommenting ? '…' : 'Reply'}
              </button>
            </div>
          </div>
        )}

        {/* Comments list */}
        {post.comments && post.comments.length > 0 && (
          <div className="post-card-comments">
            {post.comments.map((c) => (
              <div key={c.id} className="post-card-comment">
                <Avatar name={c.user?.name} src={c.user?.avatar_url} size={28} />
                <div className="post-card-comment-body">
                  <span className="post-card-comment-author">
                    {c.user?.name ?? 'User'}
                    {c.user?.has_active_verification_badge && (
                      <BadgeCheck size={12} className="inline-block ml-0.5 text-sky-500 -mt-0.5" aria-label="Verified" />
                    )}
                  </span>
                  <span className="post-card-comment-text">{c.content}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}
