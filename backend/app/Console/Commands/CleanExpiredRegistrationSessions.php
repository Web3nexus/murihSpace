<?php

namespace App\Console\Commands;

use App\Models\RegistrationSession;
use Illuminate\Console\Command;

class CleanExpiredRegistrationSessions extends Command
{
    protected $signature = 'auth:clean-registration-sessions';

    protected $description = 'Delete expired and consumed registration sessions.';

    public function handle(): int
    {
        $deleted = RegistrationSession::where(function ($query) {
            $query->where('expires_at', '<', now());
        })->delete();

        $this->info("Deleted {$deleted} expired registration sessions.");

        return self::SUCCESS;
    }
}
