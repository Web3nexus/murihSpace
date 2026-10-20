<?php

namespace App\Jobs;

use App\Models\StaffUser;
use App\Services\StaffSync\StaffSyncClient;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

/**
 * Pushes the current state of a staff account to the main backend. The job
 * carries only the id and reads the account when it runs, so retries always
 * send the latest state rather than a stale snapshot.
 *
 * An active account is upserted through /internal/staff/sync. A disabled one
 * goes through /internal/staff/disable, so a removed staff member loses access
 * on the main backend too.
 *
 * A temporary outage throws, the queue retries with backoff, and exhausted
 * jobs remain in failed_jobs (recoverable with queue:retry).
 */
class SyncStaffAccountJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 8;

    /** @var array<int, int> seconds between attempts */
    public array $backoff = [30, 120, 300, 900, 1800, 3600, 7200];

    public function __construct(public int $staffUserId) {}

    public function handle(StaffSyncClient $client): void
    {
        $staff = StaffUser::query()->find($this->staffUserId);

        if ($staff === null) {
            return;
        }

        if ($staff->isActive()) {
            $client->push($staff);

            return;
        }

        $client->disable($staff);
    }
}
