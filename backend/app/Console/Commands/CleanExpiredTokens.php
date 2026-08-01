<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Laravel\Sanctum\PersonalAccessToken;

class CleanExpiredTokens extends Command
{
    protected $signature = 'tokens:clean-expired';
    protected $description = 'Delete expired Sanctum tokens';

    public function handle(): int
    {
        $deleted = PersonalAccessToken::where('expires_at', '<', now())->delete();

        $this->info("Deleted {$deleted} expired tokens.");

        return Command::SUCCESS;
    }
}
