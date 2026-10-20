<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;
use RuntimeException;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        $this->assertStaffSyncConfigured();
    }

    /**
     * Staff changes must reach the main backend, and ads staff tokens need the hub
     * secret, so production refuses to start without them. The one exception is
     * composer's package:discover step, which runs during install before runtime env exists.
     */
    private function assertStaffSyncConfigured(): void
    {
        if (! $this->app->isProduction()) {
            return;
        }

        if ($this->app->runningInConsole() && ($_SERVER['argv'][1] ?? null) === 'package:discover') {
            return;
        }

        $missing = [];

        if (blank(config('staff_sync.main_url'))) {
            $missing[] = 'STAFF_SYNC_MAIN_URL';
        }

        if (blank(config('staff_sync.internal_token'))) {
            $missing[] = 'STAFF_SYNC_INTERNAL_TOKEN';
        }

        if (blank(config('staff_ads.hub_secret'))) {
            $missing[] = 'ADS_STAFF_HUB_SECRET';
        }

        if ($missing !== []) {
            throw new RuntimeException(
                'Staff sync is not configured. Set in production: '.implode(', ', $missing).'.'
            );
        }
    }
}
