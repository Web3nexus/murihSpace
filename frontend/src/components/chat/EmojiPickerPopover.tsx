import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { Search as MagnifyingGlass, CloseSquare as X, TimeCircle as ClockCounterClockwise } from "@/components/icons";
import { Smiley } from "@phosphor-icons/react";
import { motion } from "motion/react";
import { AnimatedEmoji } from "@/components/chat/AnimatedEmoji";
import { EMOJI_MANIFEST, EMOJI_KEYS } from "@/lib/emoji-manifest";

interface EmojiPickerPopoverProps {
  onSelect: (emoji: string) => void;
  className?: string;
  buttonClassName?: string;
  align?: "left" | "right";
}

interface EmojiCategory {
  folder: string;
  label: string;
  icon: string;
  emojis: string[];
}

// Ordered, library-backed categories — every folder exists in the animated
// emoji manifest so a tab can never render as an empty grid.
const CATEGORY_ORDER: Omit<EmojiCategory, "emojis">[] = [
  { folder: "Smileys", label: "Smileys", icon: "😀" },
  { folder: "People", label: "Gestures", icon: "👍" },
  { folder: "Animals and Nature", label: "Animals", icon: "🐶" },
  { folder: "Food and Drink", label: "Food", icon: "🍕" },
  { folder: "Activity", label: "Activities", icon: "⚽" },
  { folder: "Travel and Places", label: "Travel", icon: "🚀" },
  { folder: "Objects", label: "Objects", icon: "💡" },
  { folder: "Symbols", label: "Symbols", icon: "❤️" },
  { folder: "Flags", label: "Flags", icon: "🚩" },
];

const CATEGORY_DATA: EmojiCategory[] = CATEGORY_ORDER.map((cat) => ({
  ...cat,
  emojis: EMOJI_KEYS.filter((k) => EMOJI_MANIFEST[k]?.startsWith(`${cat.folder}/`)),
}));

// Keyword index built from the human-readable asset filenames, e.g.
// '🤝' -> "handshake deal agree" — mirrors the mobile picker's search.
const SEARCH_INDEX: Record<string, string> = Object.fromEntries(
  EMOJI_KEYS.map((k) => [
    k,
    `${k} ${k.split("").join(" ")} ${(EMOJI_MANIFEST[k] ?? "")
      .replace(/^.*\//, "")
      .replace(/\.webp$/, "")
      .toLowerCase()}`,
  ])
);

const POPULAR_ROW = ["👍", "❤️", "🔥", "😂", "👏", "🎉", "✨", "🙌", "😍", "🙏"];
const RECENTS_KEY = "murihspace:emoji_recents_v1";
const RECENTS_MAX = 28;

function useRecents() {
  const [recents, setRecents] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(RECENTS_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      // Guard against corrupted / foreign values under the same key.
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      // localStorage unavailable (private mode) — recents simply stay empty.
      return [];
    }
  });

  const markUsed = useCallback((emoji: string) => {
    setRecents((prev) => {
      const next = [emoji, ...prev.filter((e) => e !== emoji)].slice(0, RECENTS_MAX);
      try {
        localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
      } catch {
        // Ignore quota / availability errors.
      }
      return next;
    });
  }, []);

  return { recents, markUsed };
}

export function EmojiPickerPopover({
  onSelect,
  className = "",
  buttonClassName = "",
  align = "right",
}: EmojiPickerPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState(0); // 0 = Recent, 1..n = CATEGORY_DATA
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const { recents, markUsed } = useRecents();

  // Focus the search field whenever the popover opens.
  useEffect(() => {
    if (isOpen) searchRef.current?.focus();
  }, [isOpen]);

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
    markUsed(emoji);
    // Stay open so the user can insert several emojis in a row (Telegram-style).
  };

  const query = search.trim().toLowerCase();
  const filteredEmojis = useMemo(() => {
    if (!query) return [];
    const words = query.split(/\s+/);
    const results: string[] = [];
    for (const key of EMOJI_KEYS) {
      if (results.length >= 120) break;
      const haystack = SEARCH_INDEX[key];
      if (words.every((w) => haystack.includes(w))) results.push(key);
    }
    return results;
  }, [query]);

  const gridEmojis = query ? filteredEmojis : activeTab === 0 ? recents : CATEGORY_DATA[activeTab - 1]?.emojis ?? [];
  const gridLabel = query
    ? `Search Results (${filteredEmojis.length})`
    : activeTab === 0
      ? "Recent"
      : CATEGORY_DATA[activeTab - 1]?.label ?? "";

  return (
    <div ref={containerRef} className={`relative inline-block ${className}`}>
      <motion.button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer flex items-center justify-center ${
          isOpen ? "text-[#2164b6] bg-[#2164b6]/10 dark:bg-[#2164b6]/20" : ""
        } ${buttonClassName}`}
        title="Insert emoji"
        aria-label="Insert emoji"
        whileTap={{ scale: 0.95 }}
        layout
      >
        <motion.div layout>
          <Smiley weight={isOpen ? "fill" : "regular"} className="h-4 w-4" />
        </motion.div>
      </motion.button>

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
                ref={searchRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search emoji..."
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
          {!query && (
            <div className="px-2 py-1.5 border-b border-border/50 bg-muted/20 flex items-center justify-between gap-1 overflow-x-auto no-scrollbar">
              {POPULAR_ROW.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => handlePick(emoji)}
                  className="h-7 w-7 rounded-md hover:bg-muted flex items-center justify-center transition-transform hover:scale-125 cursor-pointer shrink-0"
                >
                  <AnimatedEmoji emoji={emoji} className="h-5 w-5" />
                </button>
              ))}
            </div>
          )}

          {/* Emoji Grid Body */}
          <div className="h-56 overflow-y-auto p-2.5 space-y-3">
            {gridEmojis.length > 0 ? (
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-1 mb-1.5 block">
                  {gridLabel}
                </span>
                <div className="grid grid-cols-8 gap-1">
                  {gridEmojis.map((emoji, idx) => (
                    <button
                      key={`${emoji}-${idx}`}
                      type="button"
                      onClick={() => handlePick(emoji)}
                      className="h-8 w-8 rounded-lg hover:bg-muted flex items-center justify-center transition-transform hover:scale-125 cursor-pointer"
                    >
                      <AnimatedEmoji emoji={emoji} className="h-6 w-6" />
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="py-12 text-center text-xs text-muted-foreground">
                {query
                  ? `No emoji found for "${search}"`
                  : activeTab === 0
                    ? "Emojis you use will appear here"
                    : "No emojis in this category"}
              </div>
            )}
          </div>

          {/* Category Tabs Footer */}
          {!query && (
            <div className="p-1.5 border-t border-border/70 bg-muted/30 flex items-center gap-0.5 overflow-x-auto no-scrollbar">
              <button
                type="button"
                onClick={() => setActiveTab(0)}
                className={`h-7 px-2.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 ${
                  activeTab === 0
                    ? "bg-primary/10 text-primary font-bold dark:bg-primary/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
                title="Recent"
              >
                <ClockCounterClockwise className="h-4 w-4" weight={activeTab === 0 ? "fill" : "regular"} />
                <span className="text-[11px] hidden sm:inline">Recent</span>
              </button>
              {CATEGORY_DATA.map((cat, idx) => (
                <button
                  key={cat.folder}
                  type="button"
                  onClick={() => setActiveTab(idx + 1)}
                  className={`h-7 px-2.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 ${
                    activeTab === idx + 1
                      ? "bg-primary/10 text-primary font-bold dark:bg-primary/20"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                  title={cat.label}
                >
                  <AnimatedEmoji emoji={cat.icon} className="h-4 w-4" />
                  <span className="text-[11px] hidden sm:inline">{cat.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
