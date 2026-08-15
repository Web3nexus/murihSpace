import React, { useState } from 'react';
import { Plus } from 'lucide-react';

export interface StoryUser {
  id: number | string;
  name: string;
  avatar_url?: string;
  hasUnreadStory?: boolean;
}

interface StoriesCarouselProps {
  currentUserName?: string;
  unreadMessagesCount?: number;
  stories?: StoryUser[];
  onAddStory?: () => void;
  onSelectStory?: (story: StoryUser) => void;
}

const DEFAULT_STORIES: StoryUser[] = [
  { id: '1', name: 'Caroline', avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80', hasUnreadStory: true },
  { id: '2', name: 'Steve', avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80', hasUnreadStory: true },
  { id: '3', name: 'Gregory', avatar_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80', hasUnreadStory: true },
  { id: '4', name: 'Rosalie', avatar_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80', hasUnreadStory: false },
  { id: '5', name: 'Julia', avatar_url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80', hasUnreadStory: true },
];

export const StoriesCarousel: React.FC<StoriesCarouselProps> = ({
  currentUserName = 'User',
  unreadMessagesCount = 0,
  stories = DEFAULT_STORIES,
  onAddStory,
  onSelectStory,
}) => {
  const [addingStory, setAddingStory] = useState(false);

  const handleAdd = () => {
    setAddingStory(true);
    setTimeout(() => setAddingStory(false), 1200);
    if (onAddStory) onAddStory();
  };

  return (
    <div className="w-full pt-4 pb-3 px-4 bg-card/60 border-b border-border/50 backdrop-blur-md">
      {/* Top Greeting Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h1 className="text-xl font-extrabold text-foreground tracking-tight">
            Hi {currentUserName}
          </h1>
          <p className="text-xs text-muted-foreground font-medium mt-0.5">
            {unreadMessagesCount > 0
              ? `${unreadMessagesCount} unread message${unreadMessagesCount > 1 ? 's' : ''}`
              : 'All caught up'}
          </p>
        </div>
        <div className="relative">
          <div className="h-9 w-9 rounded-full bg-muted/60 border border-border flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer transition-all shadow-xs">
            <span className="text-xs font-bold">{currentUserName.slice(0, 2).toUpperCase()}</span>
          </div>
          <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-card" />
        </div>
      </div>

      {/* Horizontal Story Scroll */}
      <div className="flex items-center gap-3.5 overflow-x-auto no-scrollbar py-1">
        {/* Add Story Pill */}
        <button
          type="button"
          onClick={handleAdd}
          className="flex flex-col items-center gap-1.5 shrink-0 group focus:outline-none"
        >
          <div className="relative h-14 w-14 rounded-full border-2 border-dashed border-muted-foreground/40 group-hover:border-secondary p-0.5 flex items-center justify-center transition-all bg-card shadow-xs">
            <div className="h-full w-full rounded-full bg-muted/40 flex items-center justify-center text-muted-foreground group-hover:text-secondary transition-colors">
              <Plus className={`h-5 w-5 ${addingStory ? 'animate-spin' : ''}`} />
            </div>
          </div>
          <span className="text-[11px] font-semibold text-muted-foreground group-hover:text-foreground transition-colors">
            Add Story
          </span>
        </button>

        {/* Stories List */}
        {stories.map((story) => (
          <button
            key={story.id}
            type="button"
            onClick={() => onSelectStory && onSelectStory(story)}
            className="flex flex-col items-center gap-1.5 shrink-0 group focus:outline-none"
          >
            <div
              className={`h-14 w-14 rounded-full p-[2px] transition-transform duration-200 group-hover:scale-105 shadow-xs ${
                story.hasUnreadStory
                  ? 'bg-gradient-to-tr from-amber-500 via-rose-500 to-primary p-[2.5px]'
                  : 'bg-border'
              }`}
            >
              <div className="h-full w-full rounded-full overflow-hidden bg-muted border-2 border-card">
                {story.avatar_url ? (
                  <img
                    src={story.avatar_url}
                    alt={story.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="h-full w-full bg-gradient-to-br from-secondary/80 to-primary text-white flex items-center justify-center font-bold text-xs">
                    {story.name.slice(0, 2).toUpperCase()}
                  </div>
                )}
              </div>
            </div>
            <span className="text-[11px] font-medium text-foreground/90 group-hover:text-secondary truncate max-w-[60px] transition-colors">
              {story.name}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};
