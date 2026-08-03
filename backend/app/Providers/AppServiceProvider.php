<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(\App\Services\Kyc\KycProviderManager::class);
        $this->app->singleton(\App\Services\Kyc\KycService::class);
    }

    public function boot(): void
    {
        RateLimiter::for('auth', function (Request $request) {
            return Limit::perMinute(5)->by($request->ip());
        });

        RateLimiter::for('kyc.session', function (Request $request) {
            return Limit::perMinutes(
                (int) config('kyc.session_rate_limit_minutes', 60),
                (int) config('kyc.session_rate_limit', 5),
            )->by($request->user()?->id ?: $request->ip());
        });

        RateLimiter::for('api', function (Request $request) {
            return Limit::perMinute(600)->by($request->user()?->id ?: $request->ip());
        });
    }
}
