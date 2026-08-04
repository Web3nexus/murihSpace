import { useState, useEffect, useCallback } from "react";
import { Trophy, Crown, Gift, Loader2 } from "lucide-react";
import { apiClient } from "@/lib/api/client";

interface TopGifter {
  sender_id: number;
  total_sent: number;
  total_gifts: number;
  sender?: {
    id: number;
    name: string;
    username: string;
    avatar?: string;
  };
}

interface TopGiftersLeaderboardProps {
  sessionId: string;
}

export function TopGiftersLeaderboard({ sessionId }: TopGiftersLeaderboardProps) {
  const [gifters, setGifters] = useState<TopGifter[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLeaderboard = useCallback(async () => {
    try {
      const res = await apiClient.get(`/gifts/leaderboard/${sessionId}`);
      const list = res.data?.data || [];
      setGifters(list);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    fetchLeaderboard();
    const interval = setInterval(fetchLeaderboard, 10000); // refresh every 10s
    return () => clearInterval(interval);
  }, [fetchLeaderboard]);

  if (loading && gifters.length === 0) {
    return (
      <div className="p-4 rounded-xl bg-card border text-xs text-muted-foreground flex items-center justify-center">
        <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> Loading leaderboard...
      </div>
    );
  }

  if (gifters.length === 0) {
    return null;
  }

  return (
    <div className="p-4 rounded-xl bg-card border border-border space-y-3 shadow-sm">
      <div className="flex items-center justify-between font-bold text-xs text-foreground border-b border-border pb-2">
        <span className="flex items-center gap-1.5">
          <Trophy className="h-4 w-4 text-amber-500" /> Session Top Supporters
        </span>
        <span className="text-[10px] text-muted-foreground font-normal uppercase tracking-wider">Live</span>
      </div>

      <div className="space-y-2">
        {gifters.map((g, idx) => {
          const rank = idx + 1;
          return (
            <div key={g.sender_id} className="flex items-center justify-between text-xs py-1 px-1.5 rounded-lg hover:bg-muted/30">
              <div className="flex items-center gap-2">
                <span className={`w-5 text-center font-bold text-xs ${rank === 1 ? "text-amber-500" : rank === 2 ? "text-slate-400" : rank === 3 ? "text-amber-700" : "text-muted-foreground"}`}>
                  {rank === 1 ? <Crown className="h-3.5 w-3.5 mx-auto text-amber-500" /> : `#${rank}`}
                </span>
                <span className="font-semibold text-foreground truncate max-w-[100px]">
                  @{g.sender?.username || `User #${g.sender_id}`}
                </span>
              </div>

              <div className="flex items-center gap-1 font-bold text-amber-600 dark:text-amber-400">
                <Gift className="h-3 w-3" />
                <span>₦{(g.total_sent / 100).toFixed(2)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
