import { useState, useRef, useEffect } from "react";
import { Smiley, MagnifyingGlass, X } from "@phosphor-icons/react";

interface EmojiPickerPopoverProps {
  onSelect: (emoji: string) => void;
  className?: string;
  buttonClassName?: string;
  align?: "left" | "right";
}

interface EmojiCategory {
  name: string;
  icon: string;
  emojis: { emoji: string; keywords: string[] }[];
}

const EMOJI_CATEGORIES: EmojiCategory[] = [
  {
    name: "Smileys & Emotion",
    icon: "😀",
    emojis: [
      { emoji: "😀", keywords: ["grinning", "happy", "smile"] },
      { emoji: "😃", keywords: ["smiley", "happy", "joy"] },
      { emoji: "😄", keywords: ["smile", "laugh", "happy"] },
      { emoji: "😁", keywords: ["grin", "eyes"] },
      { emoji: "😆", keywords: ["laughing", "satisfied"] },
      { emoji: "😅", keywords: ["sweat_smile", "nervous"] },
      { emoji: "😂", keywords: ["joy", "tears", "laugh", "lol"] },
      { emoji: "🤣", keywords: ["rofl", "rolling", "laughing"] },
      { emoji: "😊", keywords: ["blush", "proud", "friendly"] },
      { emoji: "😇", keywords: ["innocent", "angel"] },
      { emoji: "🙂", keywords: ["slightly_smiling"] },
      { emoji: "😉", keywords: ["wink", "flirt"] },
      { emoji: "😌", keywords: ["relieved", "calm"] },
      { emoji: "😍", keywords: ["heart_eyes", "love", "crush"] },
      { emoji: "🥰", keywords: ["smiling_face_with_3_hearts", "adore"] },
      { emoji: "😘", keywords: ["kissing_heart", "love"] },
      { emoji: "😋", keywords: ["yum", "delicious"] },
      { emoji: "😎", keywords: ["sunglasses", "cool"] },
      { emoji: "🤩", keywords: ["star_struck", "excited"] },
      { emoji: "🥳", keywords: ["partying", "celebrate"] },
      { emoji: "😏", keywords: ["smirk", "sly"] },
      { emoji: "😒", keywords: ["unamused", "bored"] },
      { emoji: "🙄", keywords: ["roll_eyes", "whatever"] },
      { emoji: "🤔", keywords: ["thinking", "hmm"] },
      { emoji: "🤫", keywords: ["shushing", "quiet"] },
      { emoji: "🤐", keywords: ["zipper_mouth", "secret"] },
      { emoji: "😴", keywords: ["sleeping", "tired"] },
      { emoji: "🤯", keywords: ["exploding_head", "mind_blown"] },
      { emoji: "😱", keywords: ["scream", "shocked"] },
      { emoji: "😭", keywords: ["sob", "crying", "sad"] },
      { emoji: "😢", keywords: ["cry", "tear"] },
      { emoji: "😤", keywords: ["triumph", "frustrated"] },
      { emoji: "😡", keywords: ["rage", "angry"] },
      { emoji: "🥺", keywords: ["pleading", "puppy"] },
    ],
  },
  {
    name: "Gestures & People",
    icon: "👍",
    emojis: [
      { emoji: "👍", keywords: ["thumbsup", "approve", "good", "yes", "like"] },
      { emoji: "👎", keywords: ["thumbsdown", "disapprove", "bad", "no"] },
      { emoji: "👌", keywords: ["ok_hand", "perfect"] },
      { emoji: "✌️", keywords: ["peace", "victory"] },
      { emoji: "🤞", keywords: ["crossed_fingers", "luck", "hope"] },
      { emoji: "🤟", keywords: ["love_you_gesture"] },
      { emoji: "🤘", keywords: ["sign_of_the_horns", "rock"] },
      { emoji: "🤙", keywords: ["call_me"] },
      { emoji: "👏", keywords: ["clap", "applause", "bravo"] },
      { emoji: "🙌", keywords: ["raised_hands", "hooray", "praise"] },
      { emoji: "👐", keywords: ["open_hands"] },
      { emoji: "🤲", keywords: ["palms_up_together"] },
      { emoji: "🤝", keywords: ["handshake", "deal", "agree"] },
      { emoji: "🙏", keywords: ["pray", "thank_you", "please"] },
      { emoji: "💪", keywords: ["muscle", "flex", "strong"] },
      { emoji: "👋", keywords: ["wave", "hello", "goodbye"] },
      { emoji: "✋", keywords: ["raised_hand", "stop", "high_five"] },
      { emoji: "🖐️", keywords: ["fingers_splayed"] },
      { emoji: "👊", keywords: ["fist", "punch"] },
      { emoji: "🤛", keywords: ["fist_left"] },
      { emoji: "🤜", keywords: ["fist_right"] },
      { emoji: "✍️", keywords: ["writing_hand"] },
      { emoji: "🤳", keywords: ["selfie"] },
    ],
  },
  {
    name: "Hearts & Symbols",
    icon: "❤️",
    emojis: [
      { emoji: "❤️", keywords: ["red_heart", "love"] },
      { emoji: "🧡", keywords: ["orange_heart"] },
      { emoji: "💛", keywords: ["yellow_heart"] },
      { emoji: "💚", keywords: ["green_heart"] },
      { emoji: "💙", keywords: ["blue_heart"] },
      { emoji: "💜", keywords: ["purple_heart"] },
      { emoji: "🖤", keywords: ["black_heart"] },
      { emoji: "🤍", keywords: ["white_heart"] },
      { emoji: "🤎", keywords: ["brown_heart"] },
      { emoji: "💔", keywords: ["broken_heart"] },
      { emoji: "❣️", keywords: ["heart_exclamation"] },
      { emoji: "💕", keywords: ["two_hearts"] },
      { emoji: "💞", keywords: ["revolving_hearts"] },
      { emoji: "💓", keywords: ["beating_heart"] },
      { emoji: "💗", keywords: ["growing_heart"] },
      { emoji: "💖", keywords: ["sparkling_heart"] },
      { emoji: "💘", keywords: ["cupid"] },
      { emoji: "💝", keywords: ["gift_heart"] },
      { emoji: "🔥", keywords: ["fire", "flame", "lit", "hot"] },
      { emoji: "✨", keywords: ["sparkles", "shine", "magic"] },
      { emoji: "⭐", keywords: ["star"] },
      { emoji: "🌟", keywords: ["glowing_star"] },
      { emoji: "⚡", keywords: ["zap", "lightning"] },
      { emoji: "💯", keywords: ["100", "perfect"] },
      { emoji: "🎉", keywords: ["tada", "party", "celebrate"] },
      { emoji: "🎊", keywords: ["confetti_ball"] },
      { emoji: "🎈", keywords: ["balloon"] },
      { emoji: "🎁", keywords: ["gift", "present"] },
      { emoji: "🏆", keywords: ["trophy", "winner"] },
      { emoji: "🥇", keywords: ["1st_place_medal", "gold"] },
      { emoji: "💰", keywords: ["moneybag", "cash"] },
      { emoji: "💎", keywords: ["gem", "diamond"] },
      { emoji: "🚀", keywords: ["rocket", "moon"] },
    ],
  },
];

const POPULAR_ROW = ["👍", "❤️", "🔥", "😂", "👏", "🎉", "✨", "🙌", "😍", "🙏"];

export function EmojiPickerPopover({
  onSelect,
  className = "",
  buttonClassName = "",
  align = "right",
}: EmojiPickerPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close when clicked outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const handlePick = (emoji: string) => {
    onSelect(emoji);
    setIsOpen(false);
    setSearch("");
  };

  const filteredEmojis = search.trim()
    ? EMOJI_CATEGORIES.flatMap((c) =>
        c.emojis.filter((e) =>
          e.keywords.some((k) => k.toLowerCase().includes(search.toLowerCase().trim())) ||
          e.emoji.includes(search)
        )
      )
    : [];

  return (
    <div ref={containerRef} className={`relative inline-block ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer flex items-center justify-center ${
          isOpen ? "text-[#2164b6] bg-[#2164b6]/10 dark:bg-[#2164b6]/20" : ""
        } ${buttonClassName}`}
        title="Insert emoji"
        aria-label="Insert emoji"
      >
        <Smiley weight={isOpen ? "fill" : "regular"} className="h-4 w-4" />
      </button>

      {isOpen && (
        <div
          className={`absolute bottom-full mb-2 z-50 w-72 sm:w-80 rounded-2xl bg-card border border-border shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          {/* Header with Search */}
          <div className="p-2.5 border-b border-border/70 bg-muted/40">
            <div className="relative flex items-center">
              <MagnifyingGlass className="absolute left-2.5 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search emoji..."
                autoFocus
                className="w-full h-8 pl-8 pr-7 text-xs rounded-lg bg-background border border-border/80 outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2 text-muted-foreground hover:text-foreground p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>

          {/* Quick Popular Row */}
          {!search && (
            <div className="px-2 py-1.5 border-b border-border/50 bg-muted/20 flex items-center justify-between gap-1 overflow-x-auto no-scrollbar">
              {POPULAR_ROW.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => handlePick(emoji)}
                  className="h-7 w-7 rounded-md hover:bg-muted text-base flex items-center justify-center transition-transform hover:scale-125 cursor-pointer shrink-0"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}

          {/* Emoji Grid Body */}
          <div className="h-56 overflow-y-auto p-2.5 space-y-3">
            {search.trim() ? (
              filteredEmojis.length > 0 ? (
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-1 mb-1.5 block">
                    Search Results ({filteredEmojis.length})
                  </span>
                  <div className="grid grid-cols-8 gap-1">
                    {filteredEmojis.map((e, idx) => (
                      <button
                        key={`${e.emoji}-${idx}`}
                        type="button"
                        onClick={() => handlePick(e.emoji)}
                        className="h-8 w-8 rounded-lg hover:bg-muted text-lg flex items-center justify-center transition-transform hover:scale-125 cursor-pointer"
                        title={e.keywords.join(", ")}
                      >
                        {e.emoji}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="py-12 text-center text-xs text-muted-foreground">
                  No emoji found for "{search}"
                </div>
              )
            ) : (
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-1 mb-1.5 block">
                  {EMOJI_CATEGORIES[activeCategory]?.name}
                </span>
                <div className="grid grid-cols-8 gap-1">
                  {EMOJI_CATEGORIES[activeCategory]?.emojis.map((e, idx) => (
                    <button
                      key={`${e.emoji}-${idx}`}
                      type="button"
                      onClick={() => handlePick(e.emoji)}
                      className="h-8 w-8 rounded-lg hover:bg-muted text-lg flex items-center justify-center transition-transform hover:scale-125 cursor-pointer"
                      title={e.keywords.join(", ")}
                    >
                      {e.emoji}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Category Tabs Footer */}
          {!search && (
            <div className="p-1.5 border-t border-border/70 bg-muted/30 flex items-center justify-around">
              {EMOJI_CATEGORIES.map((cat, idx) => (
                <button
                  key={cat.name}
                  type="button"
                  onClick={() => setActiveCategory(idx)}
                  className={`h-7 px-2.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                    activeCategory === idx
                      ? "bg-primary/10 text-primary font-bold dark:bg-primary/20"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                  title={cat.name}
                >
                  <span className="text-sm">{cat.icon}</span>
                  <span className="text-[11px] hidden sm:inline">{cat.name.split(" ")[0]}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

