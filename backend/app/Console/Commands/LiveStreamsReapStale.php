<?php

namespace App\Console\Commands;

use App\Models\LiveStream;
use App\Services\LiveKitAdminService;
use App\Services\LiveStreamLifecycleService;
use Illuminate\Console\Command;

/**
 * Ends live broadcasts that were abandoned rather than closed.
 *
 * A host who force-quits the app (or whose device loses connectivity) never
 * calls `POST /live/{id}/end`, so the row stays `status = live` and the stream
 * keeps advertising itself in discovery forever. This reaper uses the media
 * server as the source of truth: if the broadcast's LiveKit room no longer
 * exists, the host is gone and the stream is closed. A generous max-age acts as
 * a backstop for deployments where LiveKit is unreachable.
 */
class LiveStreamsReapStale extends Command
{
    protected $signature = 'live:reap-stale
        {--grace=180 : Seconds a broadcast may run before it is eligible for reaping}
        {--max-age=720 : Absolute upper bound in minutes for any broadcast, as a backstop}';

    protected $description = 'End live broadcasts whose host has left the media room or that have run implausibly long';

    public function handle(
        LiveKitAdminService $liveKitAdmin,
        LiveStreamLifecycleService $lifecycle,
    ): int {
        $graceSeconds = max(0, (int) $this->option('grace'));
        $maxAgeMinutes = (int) $this->option('max-age');

        $activeRooms = $liveKitAdmin->activeRoomNames();
        $roomRosterReadable = $activeRooms !== null;

        if (! $roomRosterReadable) {
            $this->warn('LiveKit room roster unavailable; only the max-age backstop will run.');
        }

        $ended = 0;

        LiveStream::query()
            ->where('status', 'live')
            ->chunkById(100, function ($streams) use ($activeRooms, $roomRosterReadable, $lifecycle, $graceSeconds, $maxAgeMinutes, &$ended) {
                foreach ($streams as $stream) {
                    if (! $this->shouldReap($stream, $activeRooms, $roomRosterReadable, $graceSeconds, $maxAgeMinutes)) {
                        continue;
                    }

                    $lifecycle->end($stream);

                    $this->line("Ended stale live stream #{$stream->id} (room {$stream->livekit_room}).");
                    $ended++;
                }
            });

        $this->info("Stale live reaping complete. Ended: {$ended}.");

        return Command::SUCCESS;
    }

    /**
     * @param  array<int, string>|null  $activeRooms
     */
    private function shouldReap(
        LiveStream $stream,
        ?array $activeRooms,
        bool $roomRosterReadable,
        int $graceSeconds,
        int $maxAgeMinutes,
    ): bool {
        $startedAt = $stream->started_at ?? $stream->created_at;

        // Never reap a broadcast during its opening grace window.
        if ($startedAt !== null && $startedAt->gt(now()->subSeconds($graceSeconds))) {
            return false;
        }

        // Absolute backstop: nothing legitimate runs this long.
        if ($maxAgeMinutes > 0 && $startedAt !== null && $startedAt->lt(now()->subMinutes($maxAgeMinutes))) {
            return true;
        }

        // Authoritative signal: the media room no longer exists, so the host has
        // left. Only trusted when the roster was actually readable.
        if ($roomRosterReadable && $stream->livekit_room !== null) {
            return ! in_array($stream->livekit_room, $activeRooms, true);
        }

        return false;
    }
}
