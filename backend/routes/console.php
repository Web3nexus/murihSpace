<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Scheduled queue monitoring heartbeat
Schedule::command('horizon:snapshot')->everyFiveMinutes();

// Settle dispute refunds still pending at the provider (backstop for lost refund webhooks)
Schedule::command('refunds:reconcile-pending --hours=24')->hourly()->withoutOverlapping();

// Escrow release timing: release due funds, hold undelivered escrows, send reminders
Schedule::command('escrow:auto-release')->hourly()->withoutOverlapping();

// Publish posts that were scheduled for future dates
Schedule::command('content:publish-scheduled')->everyMinute();

// Clean up expired download links and orphaned files (daily at 3am)
Schedule::command('downloads:clean --days=30')->dailyAt('03:00');

// Revoke expired Sanctum tokens (twice daily)
Schedule::command('tokens:clean-expired')->twiceDaily(2, 14);

// Clean up orphaned media files (weekly at 4am Sunday)
Schedule::command('media:cleanup-orphaned --days=7')->weeklyOn(0, '04:00');

// Enforce server media retention: delete expired chat media + send expiry warnings
Schedule::command('media:expire-retained')->dailyAt(config('services.media_deletion_schedule', '03:00'));

// Expire / auto-renew verification badges (hourly)
Schedule::command('verification-badges:process')->hourly();

// Clean up expired phone registration sessions (hourly)
Schedule::command('auth:clean-registration-sessions')->hourly();

// Sync live market exchange rates against USD (hourly)
Schedule::command('currency:update-rates')->hourly();

// End live broadcasts abandoned by their host (media room gone / left running)
Schedule::command('live:reap-stale')->everyFiveMinutes()->withoutOverlapping();

// Warn then close live broadcasts with no engagement (likes/chat/viewers)
Schedule::command('live:reap-idle')->everyMinute()->withoutOverlapping();

// Prune old hashtag trend buckets so trending stays fast and current
Schedule::command('hashtags:prune --days=60')->dailyAt('04:15')->withoutOverlapping();
