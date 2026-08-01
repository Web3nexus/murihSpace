<?php

namespace App\Providers;

use App\Models\ObjectStorageProvider;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\ServiceProvider;

class ObjectStorageServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        try {
            if (! DB::connection()->getSchemaBuilder()->hasTable('object_storage_providers')) {
                return;
            }

            $cacheKey = 'object_storage_providers_disks';

            $disks = Cache::remember($cacheKey, 3600, function () {
                return ObjectStorageProvider::where('is_active', true)
                    ->get()
                    ->keyBy(fn ($p) => 'db_' . $p->key)
                    ->map(fn ($p) => $p->toDiskConfig())
                    ->toArray();
            });

            foreach ($disks as $name => $config) {
                config()->set("filesystems.disks.{$name}", $config);
            }
        } catch (\Throwable $e) {
            // Database not ready yet (first deploy, migrations pending)
        }
    }
}
