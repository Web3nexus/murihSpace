import { useState, useEffect } from 'react';
import { Plus, X, Send, Loader2 } from 'lucide-react';
import StoryViewer from './StoryViewer';
import { getAuthToken } from "@/lib/auth/token";

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api/v1';

interface StoryUser {
  id: number;
  name: string;
  username: string;
  avatar?: string;
}

interface StoryItem {
  id: number;
  media_url: string;
  media_type: string;
  caption?: string;
  created_at: string;
  expires_at: string;
}

interface StoryGroup {
  user: StoryUser;
  stories: StoryItem[];
}

function getAuthHeaders(): Record<string, string> {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function StoryRings() {
  const [groups, setGroups] = useState<StoryGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [storyText, setStoryText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/stories`, { headers: getAuthHeaders() })
      .then((r) => r.json())
      .then((json) => {
        const raw = json?.data?.data ?? json?.data ?? json ?? [];
        const data = Array.isArray(raw) ? raw : [];
        setGroups(data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function removeOptimistic(groupIndex: number) {
    setGroups((prev) => prev.filter((_, i) => i !== groupIndex));
  }

  function handleCreateTextStory() {
    const text = storyText.trim();
    if (!text || submitting) return;
    setSubmitting(true);

    fetch(`${API_BASE}/stories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ media_type: 'text', caption: text }),
    })
      .then((r) => r.json())
      .then((json) => {
        const story = json?.data?.data ?? json?.data ?? json;
        if (story && story.user) {
          setGroups((prev) => {
            const newGroup: StoryGroup = {
              user: story.user,
              stories: [story],
            };
            return [newGroup, ...prev];
          });
        }
        setComposerOpen(false);
        setStoryText('');
      })
      .catch(() => {})
      .finally(() => setSubmitting(false));
  }

  if (loading) {
    return (
      <div className="flex items-center gap-4 overflow-x-auto py-3 px-4">
        <div className="w-16 h-16 rounded-full bg-muted animate-pulse flex-shrink-0" />
        <div className="w-16 h-16 rounded-full bg-muted animate-pulse flex-shrink-0" />
        <div className="w-16 h-16 rounded-full bg-muted animate-pulse flex-shrink-0" />
      </div>
    );
  }

  if (groups.length === 0) return null;

  return (
    <>
      <div className="flex items-center gap-4 overflow-x-auto py-3 px-4 no-scrollbar border-b border-border">
        <button
          onClick={() => setComposerOpen(true)}
          className="flex-shrink-0 flex flex-col items-center gap-1"
        >
          <div className="w-16 h-16 rounded-full border-2 border-dashed border-primary flex items-center justify-center bg-muted/30 hover:bg-muted/50 transition-colors">
            <Plus className="w-6 h-6 text-primary" />
          </div>
          <span className="text-[10px] text-muted-foreground">Add Story</span>
        </button>

        {groups.map((group, idx) => (
          <button
            key={group.user.id}
            onClick={() => setViewerIndex(idx)}
            className="flex-shrink-0 flex flex-col items-center gap-1"
          >
            <div className="w-16 h-16 rounded-full p-[2px] bg-gradient-to-tr from-amber-400 via-pink-500 to-purple-600">
              <div className="w-full h-full rounded-full border-2 border-background overflow-hidden bg-muted">
                {group.user.avatar ? (
                  <img src={group.user.avatar} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-lg font-bold text-muted-foreground bg-muted">
                    {group.user.name?.charAt(0)?.toUpperCase() ?? '?'}
                  </div>
                )}
              </div>
            </div>
            <span className="text-[10px] text-muted-foreground truncate max-w-[64px]">
              {group.user.name}
            </span>
          </button>
        ))}
      </div>

      {composerOpen && (
        <div className="px-4 py-3 border-b border-border">
          <div className="rounded-xl border border-border bg-card p-3 space-y-2">
            <textarea
              value={storyText}
              onChange={(e) => setStoryText(e.target.value)}
              placeholder="Share an update…"
              maxLength={500}
              className="w-full h-20 p-3 text-xs rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
            />
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">{storyText.length}/500</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setComposerOpen(false); setStoryText(''); }}
                  className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  aria-label="Close composer"
                >
                  <X className="w-4 h-4" />
                </button>
                <button
                  onClick={handleCreateTextStory}
                  disabled={submitting || !storyText.trim()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  Publish
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {viewerIndex !== null && (
        <StoryViewer
          groups={groups}
          initialIndex={viewerIndex}
          onClose={() => {
            setViewerIndex(null);
            removeOptimistic(viewerIndex);
          }}
        />
      )}
    </>
  );
}
