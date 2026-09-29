import { useEffect } from "react";
import { getEcho } from "@/lib/echo";

export interface LiveStreamEndedPayload {
  stream: {
    id: number;
    tracking_id: string;
    title: string;
    status: string;
    started_at: string | null;
    ended_at: string | null;
  };
  summary?: {
    total_likes?: number;
    peak_viewers?: number;
    total_coins_earned?: number;
  };
}

/**
 * Subscribes to the room channel for a live stream and calls `onEnded` the
 * moment the host ends it, so every viewer is pushed off the stage at once.
 * Safe to use for guests: the channel is public and needs no auth token.
 */
export function useLiveStreamEnded(
  streamId: number | null,
  onEnded: (payload: LiveStreamEndedPayload) => void
): void {
  useEffect(() => {
    if (!streamId) {
      return;
    }

    let disposed = false;
    const echo = getEcho();
    const channel = echo.channel(`live-stream.${streamId}`);

    const handleEnded = (payload: LiveStreamEndedPayload) => {
      if (disposed) {
        return;
      }
      onEnded(payload);
    };

    channel.listen("LiveStreamEnded", handleEnded);

    return () => {
      disposed = true;
      try {
        channel.stopListening("LiveStreamEnded");
        (channel as unknown as { leave: () => void }).leave();
      } catch {
        // Channel already torn down by a disconnect.
      }
    };
  }, [streamId, onEnded]);
}