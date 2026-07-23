import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router';
import {
  Users,
  Settings,
  ArrowLeft,
  Loader2,
  RefreshCw,
  Lock,
  Globe,
  DollarSign,
  Bell,
  BellOff,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import CreatePostComposer from '@/components/feed/CreatePostComposer';
import PostCard from '@/components/feed/PostCard';
import type { Post, CreatePostPayload, ReactionType } from '@/types/post';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api/v1';

interface Community {
  id: number;
  name: string;
  slug: string;
  description?: string;
  type: 'public' | 'private' | 'paid';
  logo_url?: string;
  banner_url?: string;
  member_count?: number;
  is_member?: boolean;
  membership_role?: string;
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem('auth_token');
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

function TypeIcon({ type }: { type: string }) {
  if (type === 'private') return <Lock size={14} className="community-type-icon" />;
  if (type === 'paid') return <DollarSign size={14} className="community-type-icon paid" />;
  return <Globe size={14} className="community-type-icon public" />;
}

export default function CommunityFeedPage() {
  const { slug } = useParams<{ slug: string }>();

  const [community, setCommunity] = useState<Community | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [postError, setPostError] = useState<string | null>(null);
  const [notificationsOn, setNotificationsOn] = useState(false);

  const fetchData = useCallback(async (quiet = false) => {
    if (!slug) return;
    if (!quiet) setIsLoading(true);
    else setIsRefreshing(true);
    setError(null);

    try {
      const [comm, postsRes] = await Promise.all([
        apiFetch<{ data: Community }>(`/communities/${slug}`),
        apiFetch<{ data: Post[] }>(`/communities/${slug}/posts`),
      ]);
      setCommunity(comm.data ?? (comm as unknown as Community));
      const rawPosts = (postsRes as any)?.data ?? postsRes;
      setPosts(Array.isArray(rawPosts) ? rawPosts : []);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load community');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [slug]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handlePost = async (payload: CreatePostPayload) => {
    setPostError(null);
    try {
      const created = await apiFetch<{ data: Post }>('/posts', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const newPost = (created as any)?.data ?? created;
      setPosts((prev) => [newPost as Post, ...prev]);
    } catch (e: any) {
      if (e.message?.includes('LINK_SHARING_RESTRICTED')) {
        setPostError('You don\'t have permission to share links in this community.');
      } else {
        setPostError(e.message ?? 'Failed to create post');
      }
      throw e;
    }
  };

  const handleReact = async (postId: number, type: ReactionType) => {
    await apiFetch(`/posts/${postId}/reactions`, {
      method: 'POST',
      body: JSON.stringify({ type }),
    });
    // Optimistically update
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id !== postId) return p;
        const wasReacted = p.user_reaction === type;
        return {
          ...p,
          user_reaction: wasReacted ? null : type,
          reactions_count: (p.reactions_count ?? 0) + (wasReacted ? -1 : 1),
        };
      }),
    );
  };

  const handleComment = async (postId: number, content: string) => {
    const result = await apiFetch<{ data: any }>(`/posts/${postId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
    const newComment = (result as any)?.data ?? result;
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id !== postId) return p;
        return {
          ...p,
          comments: [...(p.comments ?? []), newComment],
          comments_count: (p.comments_count ?? 0) + 1,
        };
      }),
    );
  };

  const isCreator = community?.membership_role === 'owner' || community?.membership_role === 'admin';

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="feed-loading">
        <Loader2 className="feed-spinner" />
        <span>Loading community…</span>
      </div>
    );
  }

  if (error || !community) {
    return (
      <div className="feed-error">
        <p>{error ?? 'Community not found'}</p>
        <Button variant="outline" onClick={() => fetchData()}>Retry</Button>
        <Link to="/communities" className="feed-back-link">
          <ArrowLeft size={14} /> Back to Communities
        </Link>
      </div>
    );
  }

  return (
    <div className="community-feed-page">
      {/* ── Banner ── */}
      <div
        className="community-feed-banner"
        style={community.banner_url ? { backgroundImage: `url(${community.banner_url})` } : undefined}
      >
        <div className="community-feed-banner-overlay" />
        <div className="community-feed-banner-content">
          {community.logo_url && (
            <img src={community.logo_url} alt={community.name} className="community-feed-logo" />
          )}
          <div className="community-feed-info">
            <div className="community-feed-title-row">
              <h1 className="community-feed-title">{community.name}</h1>
              <div className="community-feed-type">
                <TypeIcon type={community.type} />
                <span>{community.type}</span>
              </div>
            </div>
            {community.description && (
              <p className="community-feed-desc">{community.description}</p>
            )}
            <div className="community-feed-stats">
              <Users size={13} />
              <span>{community.member_count ?? 0} members</span>
            </div>
          </div>

          <div className="community-feed-header-actions">
            <button
              className={`feed-notif-btn ${notificationsOn ? 'on' : ''}`}
              onClick={() => setNotificationsOn((v) => !v)}
              title={notificationsOn ? 'Mute notifications' : 'Turn on notifications'}
            >
              {notificationsOn ? <Bell size={16} /> : <BellOff size={16} />}
            </button>
            {isCreator && (
              <Link to={`/communities/${slug}/settings`}>
                <Button variant="outline" size="sm" className="feed-settings-btn">
                  <Settings size={14} /> Manage
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="community-feed-layout">
        {/* Feed column */}
        <main className="community-feed-main">
          {/* Breadcrumb */}
          <div className="feed-breadcrumb">
            <Link to="/communities" className="feed-breadcrumb-link">
              <ArrowLeft size={13} />
              Communities
            </Link>
            <span>/</span>
            <span>{community.name}</span>
          </div>

          {/* Composer */}
          {community.is_member && (
            <div className="feed-composer-wrap">
              {postError && <p className="feed-post-error">{postError}</p>}
              <CreatePostComposer
                communityId={community.id}
                onPost={handlePost}
                isCreator={isCreator}
              />
            </div>
          )}

          {/* Refresh */}
          <div className="feed-refresh-row">
            <span className="feed-section-label">Posts</span>
            <button
              className="feed-refresh-btn"
              onClick={() => fetchData(true)}
              disabled={isRefreshing}
            >
              <RefreshCw size={13} className={isRefreshing ? 'spinning' : ''} />
              Refresh
            </button>
          </div>

          {/* Posts */}
          {posts.length === 0 ? (
            <div className="feed-empty">
              <div className="feed-empty-icon">📝</div>
              <h3>No posts yet</h3>
              <p>Be the first to share something with this community.</p>
            </div>
          ) : (
            <div className="feed-posts-list">
              {posts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  onReact={handleReact}
                  onComment={handleComment}
                />
              ))}
            </div>
          )}
        </main>

        {/* Sidebar */}
        <aside className="community-feed-sidebar">
          <div className="feed-sidebar-card">
            <h3 className="feed-sidebar-title">About</h3>
            <p className="feed-sidebar-desc">{community.description ?? 'No description provided.'}</p>
            <div className="feed-sidebar-stat">
              <Users size={14} />
              <span><strong>{community.member_count ?? 0}</strong> members</span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
