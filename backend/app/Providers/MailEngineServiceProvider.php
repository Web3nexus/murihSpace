<?php

namespace App\Providers;

use App\Services\MailEngineService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\ServiceProvider;

class MailEngineServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        try {
            if (! DB::connection()->getSchemaBuilder()->hasTable('admin_settings')) {
                return;
            }

            app(MailEngineService::class)->apply();
        } catch (\Throwable $e) {
            // Database not ready yet (first deploy, migrations pending)
        }
    }
}
