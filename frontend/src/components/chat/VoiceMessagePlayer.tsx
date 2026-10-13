import { useState, useEffect, useRef, useCallback } from "react";
import { Play, Activity as Waveform } from "@/components/icons";
import { PauseCircle as Pause } from "@/components/icons/rounded";;
import { cn } from "@/lib/utils";

interface VoiceMessagePlayerProps {
  src?: string;
  isMine?: boolean;
  className?: string;
}

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function VoiceMessagePlayer({ src, isMine, className }: VoiceMessagePlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    if (!src) return;
    const audio = new Audio(src);
    audio.preload = "metadata";
    audio.addEventListener("loadedmetadata", () => setDuration(audio.duration || 0));
    audio.addEventListener("timeupdate", () => setProgress(audio.currentTime));
    audio.addEventListener("ended", () => {
      setIsPlaying(false);
      setProgress(0);
    });
    audioRef.current = audio;
    return () => {
      audio.removeEventListener("ended", () => {});
      audio.pause();
      audio.src = "";
      audioRef.current = null;
    };
  }, [src]);

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      void audio.play().catch(() => {});
      setIsPlaying(true);
    }
  }, [isPlaying]);

  useEffect(() => {
    return () => audioRef.current?.pause();
  }, []);

  const pct = duration > 0 ? Math.min(100, (progress / duration) * 100) : 0;

  return (
    <div
      className={cn(
        "flex min-w-[180px] max-w-[220px] items-center gap-2 rounded-full px-2 py-1.5",
        isMine
          ? "bg-primary-foreground/15 text-primary-foreground"
          : "bg-muted text-foreground",
        className,
      )}
    >
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          toggle();
        }}
        aria-label={isPlaying ? "Pause voice message" : "Play voice message"}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors hover:opacity-80"
      >
        {isPlaying ? (
          <Pause weight="fill" className="h-4 w-4" />
        ) : (
          <Play weight="fill" className="h-4 w-4" />
        )}
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Waveform
            weight="fill"
            className={cn("h-3.5 w-3.5 shrink-0", isMine ? "text-primary-foreground/70" : "text-muted-foreground/70")}
          />
          <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-foreground/10">
            <div
              className="absolute inset-y-0 left-0 rounded-full"
              style={{
                width: `${pct}%`,
                backgroundColor: isMine ? "var(--secondary)" : "var(--ring)",
              }}
            />
          </div>
        </div>
      </div>

      <span className={cn("shrink-0 text-[10px] font-semibold tabular-nums", isMine ? "text-primary-foreground/80" : "text-muted-foreground")}>
        {isPlaying && duration > 0 ? formatDuration(Math.max(0, duration - progress)) : formatDuration(duration)}
      </span>

      <audio ref={audioRef} src={src} className="hidden" aria-hidden="true">
        <track kind="captions" />
      </audio>
    </div>
  );
}