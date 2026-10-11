<?php

namespace App\Console\Commands;

use App\Models\LiveStream;
use App\Notifications\MurihOfficialNotification;
use App\Services\LiveStreamLifecycleService;
use Illuminate\Console\Command;

/**
 * Closes broadcasts nobody is engaging with.
 *
 * A host can leave the app open (or the camera running) with no audience and no
 * interaction, leaving a dead stream advertising itself in discovery for days.
 * When a broadcast goes a full idle window without a like, chat message or new
 * viewer, the host is warned once; if engagement does not resume within the
 * grace window, the broadcast is closed automatically.
 *
 * Any engagement clears `idle_warned_at` (see LiveStream::touchEngagement), so
 * a stream that comes back to life simply restarts the clock instead of being
 * closed mid-conversation.
 */
class LiveStreamsReapIdle extends Command
{
    protected $signature = 'live:reap-idle
        {--idle=600 : Seconds of no engagement before the host is warned}
        {--grace=300 : Seconds after the warning before the broadcast is closed}';

    protected $description = 'Warn hosts of unattended live broadcasts, then auto-close them if engagement never resumes';

    public function handle(LiveStreamLifecycleService $lifecycle): int
    {
        $idleSeconds = max(60, (int) $this->option('idle'));
        $graceSeconds = max(30, (int) $this->option('grace'));

        $warned = 0;
        $closed = 0;

        LiveStream::query()
            ->where('status', 'live')
            ->with('host:id,name,username')
            ->chunkById(100, function ($streams) use ($lifecycle, $idleSeconds, $graceSeconds, &$warned, &$closed) {
                foreach ($streams as $stream) {
                    $idleSince = $stream->last_engagement_at ?? $stream->started_at ?? $stream->created_at;

                    if ($idleSince === null) {
                        continue;
                    }

                    // Engaged recently enough — leave it alone.
                    if ($idleSince->gt(now()->subSeconds($idleSeconds))) {
                        continue;
                    }

                    // Crossed the idle threshold for the first time: nudge the
                    // host once and start the grace clock.
                    if ($stream->idle_warned_at === null) {
                        $this->warnHost($stream, $graceSeconds);
                        $stream->forceFill(['idle_warned_at' => now()])->saveQuietly();
                        $warned++;
                        continue;
                    }

                    // Grace elapsed with no engagement since the warning (any
                    // engagement would have cleared idle_warned_at): close it.
                    // endIfLive() claims the transition atomically, so a stream
                    // already ended elsewhere (host tap, stale reaper) reports
                    // null and we skip the duplicate close notice.
                    if ($stream->idle_warned_at->lte(now()->subSeconds($graceSeconds))) {
                        if ($lifecycle->endIfLive($stream) === null) {
                            continue;
                        }

                        $this->notifyClosed($stream);
                        $this->line("Closed idle live stream #{$stream->id} (host {$stream->user_id}).");
                        $closed++;
                    }
                }
            });

        $this->info("Idle live reaping complete. Warned: {$warned}, Closed: {$closed}.");

        return Command::SUCCESS;
    }

    private function warnHost(LiveStream $stream, int $graceSeconds): void
    {
        $minutes = max(1, (int) ceil($graceSeconds / 60));

        $stream->host?->notify(new MurihOfficialNotification(
            type: 'live_idle_warning',
            title: 'Your live has no engagement',
            body: "Nobody has liked, joined or chatted for a while. It will end automatically in about {$minutes} minute(s) unless engagement resumes.",
            actionUrl: '/live/'.rawurlencode((string) $stream->tracking_id),
            actionLabel: 'Back to your live',
            route: '/live/'.rawurlencode((string) $stream->tracking_id),
            metadata: ['live_stream_id' => $stream->id],
        ));

        $this->line("Warned host of idle live stream #{$stream->id}.");
    }

    private function notifyClosed(LiveStream $stream): void
    {
        $stream->host?->notify(new MurihOfficialNotification(
            type: 'live_idle_closed',
            title: 'Your live was ended',
            body: 'Your broadcast was closed automatically because it had no viewers or engagement.',
            route: '/app/live-now',
            metadata: ['live_stream_id' => $stream->id],
        ));
    }
}
