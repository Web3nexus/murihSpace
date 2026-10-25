<?php

namespace App\Services\Moderation;

use App\Models\Report;
use App\Models\User;
use App\Services\NotificationService;
use App\Services\UserEnforcementService;

/**
 * Suspends an account automatically when several different people report it in a short space of time.
 *
 * Counts distinct reporters, so one person filing again does not count twice. Dismissed reports
 * do not count. The suspension is appealable; a moderator reviews it through the account team.
 */
class ReportThresholdSuspension
{
    public function __construct(
        private readonly UserEnforcementService $enforcement,
        private readonly NotificationService $notifications,
    ) {}

    /** @return bool true when this call suspended the account */
    public function evaluate(User $target): bool
    {
        if (! in_array($target->status, ['active', null], true)) {
            return false;
        }

        $threshold = (int) config('moderation.auto_suspend.reporters', 3);
        $windowDays = (int) config('moderation.auto_suspend.window_days', 7);

        $reporters = Report::where('reported_type', 'user')
            ->where('reported_id', $target->id)
            ->where('status', '!=', 'dismissed')
            ->where('created_at', '>=', now()->subDays($windowDays))
            ->distinct()
            ->count('reporter_id');

        if ($reporters < $threshold) {
            return false;
        }

        $reason = "Reported by {$reporters} different people within {$windowDays} days. Suspended pending review.";
        $this->enforcement->suspend(null, $target, $reason, 'auto_reports');

        // The suspension is already saved. A failed email must not undo it or fail the report.
        try {
            $this->notifications->actionEmail(
                user: $target,
                title: 'Your account has been suspended',
                bodyHtml: '<p>Your MurihSpace account has been <strong>temporarily suspended</strong> after several reports from other members. '
                    .'Our account team will review them.</p>'
                    .'<p>If you believe this was a mistake, open the MurihSpace app and choose <strong>Appeal</strong> on the sign-in screen.</p>',
                footnote: 'Your balance is not affected by this suspension.',
            );
        } catch (\Throwable $e) {
            report($e);
        }

        return true;
    }
}
