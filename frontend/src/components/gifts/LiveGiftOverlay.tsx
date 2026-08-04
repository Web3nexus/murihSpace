import { useEffect, useState } from "react";
import { Sparkles, Gift, Flame } from "lucide-react";

export interface GiftEventPayload {
  sender: {
    id: number;
    name: string;
    username: string;
    avatar?: string;
  };
  gift: {
    id: number;
    name: string;
    icon?: string;
    animation_type?: "micro" | "standard" | "premium" | "full_screen";
  };
  amount: number;
  currency: string;
  sent_at: string;
}

interface LiveGiftOverlayProps {
  giftEvent?: GiftEventPayload | null;
  onAnimationComplete?: () => void;
}

export function LiveGiftOverlay({ giftEvent, onAnimationComplete }: LiveGiftOverlayProps) {
  const [activeGift, setActiveGift] = useState<GiftEventPayload | null>(null);

  useEffect(() => {
    if (!giftEvent) return;
    setActiveGift(giftEvent);

    const duration = giftEvent.gift.animation_type === "full_screen" ? 5000 : 3500;
    const timer = setTimeout(() => {
      setActiveGift(null);
      if (onAnimationComplete) onAnimationComplete();
    }, duration);

    return () => clearTimeout(timer);
  }, [giftEvent, onAnimationComplete]);

  if (!activeGift) return null;

  const isFullScreen = activeGift.gift.animation_type === "full_screen";
  const isPremium = activeGift.gift.animation_type === "premium" || isFullScreen;

  return (
    <div
      className={`fixed inset-0 pointer-events-none z-50 flex items-center justify-center transition-all ${
        isFullScreen ? "bg-black/40 backdrop-blur-sm" : ""
      }`}
    >
      <div
        className={`animate-bounce-in flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl border backdrop-blur-md ${
          isPremium
            ? "bg-gradient-to-r from-purple-900/90 via-indigo-900/90 to-slate-900/90 border-purple-500/50 text-white scale-110"
            : "bg-slate-900/85 border-slate-700 text-white"
        }`}
      >
        <div className="relative">
          <div className="w-12 h-12 rounded-full bg-primary/20 border border-primary flex items-center justify-center overflow-hidden">
            {activeGift.sender.avatar ? (
              <img src={activeGift.sender.avatar} alt={activeGift.sender.name} className="w-full h-full object-cover" />
            ) : (
              <Gift className="h-6 w-6 text-primary" />
            )}
          </div>
          {isPremium && (
            <Sparkles className="h-5 w-5 text-amber-400 absolute -top-1 -right-1 animate-spin" />
          )}
        </div>

        <div>
          <div className="flex items-center gap-1.5 font-bold text-sm">
            <span className="text-primary">@{activeGift.sender.username}</span>
            <span className="text-white/80 font-normal">sent a</span>
            <span className="text-amber-300 font-extrabold">{activeGift.gift.name}</span>
          </div>
          <div className="text-xs text-white/60 flex items-center gap-1 mt-0.5">
            <Flame className="h-3.5 w-3.5 text-orange-400" />
            <span>₦{(activeGift.amount / 100).toFixed(2)} contribution</span>
          </div>
        </div>

        <div className="text-3xl ml-2">
          {activeGift.gift.icon || "🎁"}
        </div>
      </div>
    </div>
  );
}
