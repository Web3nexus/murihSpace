import { useState, useEffect, useRef } from "react";
import { Link } from "react-router";
import { apiClient } from "@/lib/api/client";
import {
  SealCheck,
  Heart,
  ChatCircle,
  ShareNetwork,
  ArrowSquareOut,
  X,
  SpeakerHigh as Volume2,
  SpeakerSlash as VolumeX,
  DotsThree,
  Megaphone,
  Info,
} from "@phosphor-icons/react";

export interface SponsoredAdData {
  id: string | number;
  campaign_id: number | string;
  advertiser_name: string;
  advertiser_avatar?: string | null;
  headline: string;
  description: string;
  media_url?: string;
  media_type?: string;
  cta_text?: string;
  destination_url?: string;
  skip_countdown?: number; // e.g. 5 seconds
  likes?: number;
  comments?: number;
  badge?: string;
}

interface InterPostSponsoredAdProps {
  ad: SponsoredAdData;
  onDismiss?: (id: string | number) => void;
}

export function InterPostSponsoredAd({ ad, onDismiss }: InterPostSponsoredAdProps) {
  const [countdown, setCountdown] = useState(ad.skip_countdown ?? 5);
  const [canSkip, setCanSkip] = useState((ad.skip_countdown ?? 5) <= 0);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(ad.likes ?? 342);
  const [muted, setMuted] = useState(true);
  const impressionLogged = useRef(false);

  // Countdown timer: decrement by 1 second until 0
  useEffect(() => {
    if (countdown <= 0) {
      setCanSkip(true);
      return;
    }

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setCanSkip(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [countdown]);

  // Record impression on mount
  useEffect(() => {
    if (!impressionLogged.current) {
      impressionLogged.current = true;
      apiClient
        .post("/ads/track/impression", { ad_id: ad.id, campaign_id: ad.campaign_id })
        .catch(() => {});
    }
  }, [ad.id, ad.campaign_id]);

  const handleAdClick = () => {
    apiClient
      .post("/ads/track/click", { ad_id: ad.id, campaign_id: ad.campaign_id })
      .catch(() => {});
  };

  const handleSkip = () => {
    if (!canSkip) return;
    setIsDismissed(true);
    if (onDismiss) {
      setTimeout(() => onDismiss(ad.id), 250);
    }
  };

  const handleToggleLike = () => {
    setIsLiked((prev) => !prev);
    setLikeCount((c) => (isLiked ? c - 1 : c + 1));
  };

  if (isDismissed) {
    return null;
  }

  const isInternal = ad.destination_url?.startsWith("/");

  return (
    <div className="rounded-2xl bg-card border-2 border-primary/20 p-4 sm:p-5 space-y-3.5 shadow-md relative overflow-hidden transition-all animate-in fade-in duration-300">
      {/* ── Top Sponsored Header (Facebook / TikTok Style) ── */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-full bg-gradient-to-tr from-[#2164b6] to-blue-500 p-[2px] shrink-0">
            <div className="w-full h-full rounded-full bg-card overflow-hidden flex items-center justify-center font-bold text-xs text-primary">
              {ad.advertiser_avatar ? (
                <img src={ad.advertiser_avatar} alt="" className="w-full h-full object-cover" />
              ) : (
                <Megaphone weight="fill" className="h-5 w-5 text-[#2164b6]" />
              )}
            </div>
          </div>

          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold text-foreground">{ad.advertiser_name}</span>
              <SealCheck weight="fill" className="h-4 w-4 text-sky-500 shrink-0" />
              <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-[#2164b6]/10 text-[#2164b6] dark:text-[#7ab0ff]">
                Sponsored
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
              <span>Promoted</span>
              <span>·</span>
              <span>🌐 Public Placement</span>
            </p>
          </div>
        </div>

        {/* ── Unskippable Countdown Timer / Skip Ad Control ── */}
        <div className="flex items-center gap-2">
          {canSkip ? (
            <button
              type="button"
              onClick={handleSkip}
              className="px-3 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-bold text-foreground transition-all flex items-center gap-1 shadow-xs cursor-pointer active:scale-95"
            >
              <span>Skip Ad</span>
              <X weight="bold" className="w-3.5 h-3.5" />
            </button>
          ) : (
            <div className="px-3 py-1.5 rounded-full bg-slate-900/80 backdrop-blur-md text-white text-[11px] font-bold flex items-center gap-1.5 ring-1 ring-white/20 select-none">
              <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <span>Skip in {countdown}s</span>
            </div>
          )}

          <button
            type="button"
            className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg"
            title="Ad Settings"
          >
            <DotsThree weight="bold" className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* ── Headline & Copy ── */}
      <div className="space-y-1">
        <h3 className="text-sm sm:text-base font-bold text-foreground leading-snug">
          {ad.headline}
        </h3>
        <p className="text-xs sm:text-sm text-foreground/90 leading-relaxed whitespace-pre-line">
          {ad.description}
        </p>
      </div>

      {/* ── Media Creative (Image / Video Mockup) ── */}
      {ad.media_url && (
        <div className="relative rounded-2xl overflow-hidden bg-slate-950 group">
          <img
            src={ad.media_url}
            alt={ad.headline}
            className="w-full max-h-[420px] object-cover"
          />

          {/* Sound toggle button for video feel */}
          <button
            type="button"
            onClick={() => setMuted((m) => !m)}
            className="absolute bottom-3 right-3 p-2 rounded-full bg-black/60 backdrop-blur-md text-white hover:bg-black/80 transition-all"
            title={muted ? "Unmute" : "Mute"}
          >
            {muted ? (
              <VolumeX weight="fill" className="w-4 h-4" />
            ) : (
              <Volume2 weight="fill" className="w-4 h-4" />
            )}
          </button>
        </div>
      )}

      {/* ── Call to Action Action Bar ── */}
      {ad.destination_url && (
        <div className="pt-1">
          {isInternal ? (
            <Link
              to={ad.destination_url}
              onClick={handleAdClick}
              className="w-full h-11 rounded-xl bg-[#2164b6] hover:bg-[#1a5091] text-white font-bold text-xs sm:text-sm transition-all shadow-md flex items-center justify-center gap-2"
            >
              <span>{ad.cta_text || "Learn More"}</span>
              <ArrowSquareOut weight="bold" className="w-4 h-4" />
            </Link>
          ) : (
            <a
              href={ad.destination_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleAdClick}
              className="w-full h-11 rounded-xl bg-[#2164b6] hover:bg-[#1a5091] text-white font-bold text-xs sm:text-sm transition-all shadow-md flex items-center justify-center gap-2"
            >
              <span>{ad.cta_text || "Learn More"}</span>
              <ArrowSquareOut weight="bold" className="w-4 h-4" />
            </a>
          )}
        </div>
      )}

      {/* ── Social Engagement Controls ── */}
      <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border/50">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={handleToggleLike}
            className={`flex items-center gap-1.5 font-semibold transition-colors ${
              isLiked ? "text-rose-500" : "hover:text-foreground"
            }`}
          >
            <Heart weight={isLiked ? "fill" : "regular"} className="w-4 h-4" />
            <span>{likeCount}</span>
          </button>

          <button
            type="button"
            className="flex items-center gap-1.5 font-semibold hover:text-foreground transition-colors"
          >
            <ChatCircle weight="regular" className="w-4 h-4" />
            <span>{ad.comments ?? 28}</span>
          </button>

          <button
            type="button"
            className="flex items-center gap-1.5 font-semibold hover:text-foreground transition-colors"
          >
            <ShareNetwork weight="regular" className="w-4 h-4" />
            <span>Share</span>
          </button>
        </div>

        <span className="text-[11px] text-muted-foreground flex items-center gap-1">
          <Info weight="fill" className="w-3.5 h-3.5" />
          <span>Sponsored Ad</span>
        </span>
      </div>
    </div>
  );
}

