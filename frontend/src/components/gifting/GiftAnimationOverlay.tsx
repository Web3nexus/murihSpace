import { useEffect, useState } from "react";
import { Sparkles, Coins, Gift as GiftIcon } from "lucide-react";

export interface GiftAnimationData {
  giftName: string;
  iconUrl?: string | null;
  coinPrice: number;
  senderName?: string;
  animationType?: "micro" | "standard" | "premium" | "full_screen";
}

interface GiftAnimationOverlayProps {
  data: GiftAnimationData | null;
  onComplete?: () => void;
}

export function GiftAnimationOverlay({ data, onComplete }: GiftAnimationOverlayProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (data) {
      setVisible(true);
      const duration = data.animationType === "full_screen" ? 4500 : data.animationType === "premium" ? 3500 : 2500;
      const timer = setTimeout(() => {
        setVisible(false);
        if (onComplete) onComplete();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [data, onComplete]);

  if (!visible || !data) return null;

  const isFullScreen = data.animationType === "full_screen";
  const isPremium = data.animationType === "premium" || isFullScreen;

  return (
    <div className="fixed inset-0 pointer-events-none z-[9999] flex items-center justify-center overflow-hidden">
      {/* Darkened backdrop for premium/fullscreen */}
      {isPremium && (
        <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] animate-fade-in duration-300" />
      )}

      {/* Floating Light Rays */}
      <div className="absolute w-[500px] h-[500px] bg-gradient-to-tr from-amber-400/20 via-pink-500/20 to-purple-600/20 rounded-full blur-3xl animate-pulse" />

      {/* Sparkling Floating Particles */}
      <div className="absolute inset-0 flex items-center justify-center">
        {[...Array(16)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-amber-400 animate-ping"
            style={{
              width: `${Math.random() * 8 + 4}px`,
              height: `${Math.random() * 8 + 4}px`,
              transform: `translate(${(Math.random() - 0.5) * 350}px, ${(Math.random() - 0.5) * 350}px)`,
              animationDuration: `${1 + Math.random() * 1.5}s`,
              animationDelay: `${Math.random() * 0.5}s`,
            }}
          />
        ))}
      </div>

      {/* Main Animated Card */}
      <div className="relative z-10 flex flex-col items-center justify-center p-6 text-center animate-bounce-in">
        {/* Glow Aura behind image */}
        <div className="relative mb-4 group">
          <div className="absolute -inset-4 rounded-full bg-gradient-to-r from-amber-500 via-pink-500 to-purple-600 blur-xl opacity-80 animate-spin-slow" />
          
          <div className="relative w-32 h-32 sm:w-40 sm:h-40 rounded-3xl bg-card/90 border-2 border-amber-400/60 shadow-2xl flex items-center justify-center p-4 backdrop-blur-md">
            {data.iconUrl ? (
              <img
                src={data.iconUrl}
                alt={data.giftName}
                className="w-full h-full object-contain drop-shadow-[0_10px_20px_rgba(0,0,0,0.3)] animate-pulse"
              />
            ) : (
              <GiftIcon className="w-20 h-20 text-pink-500" />
            )}
          </div>
        </div>

        {/* Sender & Gift Banner */}
        <div className="space-y-1 bg-background/90 border border-amber-500/40 px-6 py-3 rounded-2xl shadow-2xl backdrop-blur-xl">
          <p className="text-xs uppercase tracking-widest font-bold text-amber-500 flex items-center justify-center gap-1">
            <Sparkles className="w-3.5 h-3.5" /> Gift Sent! <Sparkles className="w-3.5 h-3.5" />
          </p>
          <h3 className="text-xl sm:text-2xl font-black text-foreground">
            {data.senderName ? `${data.senderName} sent ` : ""}{data.giftName}
          </h3>
          <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-extrabold">
            <Coins className="w-3.5 h-3.5 text-amber-500" />
            <span>{data.coinPrice.toLocaleString()} Coins</span>
          </div>
        </div>
      </div>
    </div>
  );
}
