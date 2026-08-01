import { useState, useEffect, useCallback, useRef } from 'react';
import { X, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
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

interface Props {
  groups: StoryGroup[];
  initialIndex: number;
  onClose: () => void;
}

export default function StoryViewer({ groups, initialIndex, onClose }: Props) {
  const [groupIdx, setGroupIdx] = useState(initialIndex);
  const [storyIdx, setStoryIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const currentGroup = groups[groupIdx];
  const currentStory = currentGroup?.stories?.[storyIdx];

  const advance = useCallback(() => {
    if (!currentGroup) return;
    if (storyIdx < currentGroup.stories.length - 1) {
      setStoryIdx((i) => i + 1);
      setProgress(0);
    } else if (groupIdx < groups.length - 1) {
      setGroupIdx((i) => i + 1);
      setStoryIdx(0);
      setProgress(0);
    } else {
      onClose();
    }
  }, [currentGroup, storyIdx, groupIdx, groups.length, onClose]);

  const goBack = useCallback(() => {
    if (storyIdx > 0) {
      setStoryIdx((i) => i - 1);
      setProgress(0);
    } else if (groupIdx > 0) {
      setGroupIdx((i) => i - 1);
      const prevGroup = groups[groupIdx - 1];
      setStoryIdx(prevGroup.stories.length - 1);
      setProgress(0);
    }
  }, [storyIdx, groupIdx, groups]);

  useEffect(() => {
    if (!currentStory) return;
    const duration = 5000;
    const interval = 50;
    const step = (interval / duration) * 100;

    setProgress(0);
    timerRef.current = setInterval(() => {
      setProgress((p) => {
        const next = p + step;
        if (next >= 100) {
          clearInterval(timerRef.current!);
          advance();
          return 0;
        }
        return next;
      });
    }, interval);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [currentStory, advance]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') advance();
      if (e.key === 'ArrowLeft') goBack();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [advance, goBack, onClose]);

  if (!currentGroup || !currentStory) return null;

  const currentUserId = (() => {
    try {
      const user = JSON.parse(localStorage.getItem('murihspace-user') ?? '{}');
      return user.id;
    } catch { return null; }
  })();

  async function handleDelete() {
    if (!currentStory) return;
    try {
      await fetch(`${API_BASE}/stories/${currentStory.id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      onClose();
    } catch { /* ignore */ }
  }

  function handleContainerClick(e: React.MouseEvent) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    if (x < rect.width * 0.33) {
      goBack();
    } else if (x > rect.width * 0.66) {
      advance();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black">
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 p-2 rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors"
      >
        <X className="w-5 h-5" />
      </button>

      {/* Progress bars */}
      <div className="absolute top-2 left-2 right-2 z-10 flex gap-1">
        {currentGroup.stories.map((_, idx) => (
          <div key={idx} className="flex-1 h-0.5 bg-white/30 rounded-full overflow-hidden">
            <div
              className="h-full bg-white transition-all duration-75"
              style={{
                width: idx === storyIdx ? `${progress}%` : idx < storyIdx ? '100%' : '0%',
              }}
            />
          </div>
        ))}
      </div>

      {/* Top bar with user info */}
      <div className="absolute top-6 left-4 z-10 flex items-center gap-3">
        <div className="w-9 h-9 rounded-full overflow-hidden border-2 border-white/50 bg-white/20">
          {currentGroup.user.avatar ? (
            <img src={currentGroup.user.avatar} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-sm font-bold text-white">
              {currentGroup.user.name?.charAt(0)?.toUpperCase() ?? '?'}
            </div>
          )}
        </div>
        <span className="text-sm font-semibold text-white drop-shadow-sm">{currentGroup.user.name}</span>
        {currentUserId === currentGroup.user.id && (
          <button onClick={handleDelete} className="p-1 rounded-full bg-black/30 text-white/70 hover:text-white hover:bg-black/50 transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Media area */}
      <div
        className="w-full h-full flex items-center justify-center cursor-pointer select-none"
        onClick={handleContainerClick}
      >
        {currentStory.media_type === 'text' ? (
          <div className="max-w-lg px-6 text-center">
            <p className="text-xl sm:text-2xl font-medium text-white leading-relaxed">
              {currentStory.caption || 'New story'}
            </p>
          </div>
        ) : currentStory.media_type === 'video' ? (
          <video
            src={currentStory.media_url}
            className="max-w-full max-h-full object-contain"
            autoPlay
            playsInline
            onEnded={advance}
          />
        ) : (
          <img
            src={currentStory.media_url}
            alt=""
            className="max-w-full max-h-full object-contain"
            draggable={false}
          />
        )}

        {/* Navigation arrows */}
        {groupIdx > 0 && (
          <button
            onClick={(e) => { e.stopPropagation(); goBack(); }}
            className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/30 text-white hover:bg-black/50 transition-colors"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}
        {groupIdx < groups.length - 1 && (
          <button
            onClick={(e) => { e.stopPropagation(); advance(); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/30 text-white hover:bg-black/50 transition-colors"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        )}
      </div>

      {/* Caption */}
      {currentStory.caption && currentStory.media_type !== 'text' && (
        <div className="absolute bottom-8 left-4 right-4 z-10">
          <p className="text-sm text-white/90 text-center drop-shadow-md">{currentStory.caption}</p>
        </div>
      )}
    </div>
  );
}
