<?php

namespace App\Services;

use App\Events\LiveStreamEnded;
use App\Models\LiveStream;
use App\Models\LiveStreamParticipant;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Single source of truth for ending a broadcast.
 *
 * Both the host-initiated `POST /live/{id}/end` and the scheduled stale-idle
 * reapers funnel through here so a broadcast is torn down identically no matter
 * who ends it: the row is closed, the roster is retired, the media room is
 * emptied, and viewers are told the live is over.
 */
class LiveStreamLifecycleService
{
    public function __construct(
        private readonly LiveKitAdminService $liveKitAdmin,
        private readonly LiveStreamPresenceService $presence,
    ) {}

    /**
     * Close out a broadcast and return its final statistics summary.
     *
     * Idempotent: ending an already-ended broadcast is a no-op and simply
     * re-derives the summary from the stored values.
     *
     * @return array{total_likes:int,peak_viewers:int,total_coins_earned:int,duration_seconds:int}
     */
    public function end(LiveStream $stream): array
    {
        return $this->endIfLive($stream) ?? $this->summary($stream);
    }

    /**
     * Atomically end a live broadcast, running the teardown only for the caller
     * that actually transitions the row from `live` to `ended`.
     *
     * A stream can end between a caller's `status = live` select and this call
     * (host tap racing a reaper, or the stale and idle reapers overlapping), so
     * the transition is claimed with a conditional update. Losers get `null`
     * and therefore never overwrite `ended_at`, re-broadcast `LiveStreamEnded`,
     * or send a duplicate "your live ended" notice.
     *
     * @return array{total_likes:int,peak_viewers:int,total_coins_earned:int,duration_seconds:int}|null
     *         The final summary, or `null` when the stream was already ended.
     */
    public function endIfLive(LiveStream $stream): ?array
    {
        $endedAt = now();

        $claimed = LiveStream::whereKey($stream->id)
            ->where('status', 'live')
            ->update([
                'status' => 'ended',
                'ended_at' => $endedAt,
                'viewers_count' => 0,
            ]);

        // Someone else closed it first: leave their teardown and notification
        // as the single source of truth.
        if ($claimed === 0) {
            return null;
        }

        // Reflect the claimed transition on the in-memory model so downstream
        // reads (e.g. the controller's response) see the final state.
        $stream->forceFill([
            'status' => 'ended',
            'ended_at' => $endedAt,
            'viewers_count' => 0,
        ]);

        // Mark all active participants as inactive.
        LiveStreamParticipant::where('live_stream_id', $stream->id)
            ->where('is_active', true)
            ->update([
                'is_active' => false,
                'left_at' => now(),
            ]);

        // Drop every remaining viewer from the media room so the LiveKit
        // session genuinely closes when the broadcast ends. Removing only the
        // host left viewers connected to a stream the database had already
        // marked ended.
        $hostParticipant = LiveStreamParticipant::where('live_stream_id', $stream->id)
            ->where('user_id', $stream->user_id)
            ->first()
            ?? new LiveStreamParticipant([
                'live_stream_id' => $stream->id,
                'user_id' => $stream->user_id,
            ]);

        $this->liveKitAdmin->removeAllParticipants(
            $stream->livekit_room,
            $this->presence->identityFor($hostParticipant),
        );

        $summary = $this->summary($stream);

        // Tell every viewer still on this stream that the live is over.
        try {
            LiveStreamEnded::dispatch($stream, $summary);
        } catch (Throwable $e) {
            Log::warning('[LiveStreamLifecycle] LiveStreamEnded broadcast failed: '.$e->getMessage(), ['stream_id' => $stream->id]);
        }

        return $summary;
    }

    /**
     * Build the statistics summary from the stream's stored counters.
     *
     * @return array{total_likes:int,peak_viewers:int,total_coins_earned:int,duration_seconds:int}
     */
    private function summary(LiveStream $stream): array
    {
        $endedAt = $stream->ended_at ?? now();

        return [
            'total_likes' => (int) $stream->likes_count,
            'peak_viewers' => (int) $stream->peak_viewers,
            'total_coins_earned' => (int) $stream->total_coins_earned,
            'duration_seconds' => $stream->started_at ? $endedAt->diffInSeconds($stream->started_at) : 0,
        ];
    }
}
