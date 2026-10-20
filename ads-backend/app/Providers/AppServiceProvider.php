<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;
use RuntimeException;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Settings that have no safe default. Production refuses to boot without
     * them, so a missing value never silently falls back to a domain.
     *
     * @var array<string, string>  config key => env name (for the error message)
     */
    private const REQUIRED_IN_PRODUCTION = [
        'app.url' => 'APP_URL',
        'ads.frontend_url' => 'FRONTEND_URL',
        'ads.staff_hub_secret' => 'ADS_STAFF_HUB_SECRET',
        'mail.from.address' => 'MAIL_FROM_ADDRESS',
        'services.murihspace.sso_base_url' => 'MURIHSPACE_SSO_BASE_URL',
        'services.murihspace.internal_token' => 'MURIHSPACE_INTERNAL_TOKEN',
        'services.murihspace.redirect_uri' => 'MURIHSPACE_SSO_REDIRECT_URI',
    ];

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
        if ($this->app->environment('production')) {
            $this->assertRequiredConfiguration();
        }
    }

    private function assertRequiredConfiguration(): void
    {
        $missing = [];
        foreach (self::REQUIRED_IN_PRODUCTION as $configKey => $envName) {
            if (blank(config($configKey))) {
                $missing[] = $envName;
            }
        }

        if ($missing !== []) {
            throw new RuntimeException(
                'Refusing to boot in production. Missing required environment values: '.implode(', ', $missing).'.'
            );
        }
    }
}
