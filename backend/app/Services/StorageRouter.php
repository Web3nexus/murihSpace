<?php

namespace App\Services;

use App\Models\AdminSetting;
use App\Models\ObjectStorageProvider;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Storage;

class StorageRouter
{
    private const CACHE_KEY = 'storage_rules_config';
    private const CACHE_TTL = 3600;

    public function resolve(string $mimeType, ?string $folder = null): array
    {
        $config = $this->getConfig();
        $rule = $this->matchRule($mimeType, $config['rules'] ?? []);

        if ($rule) {
            return [
                'disk' => $rule['disk'],
                'folder' => $folder ?? $rule['folder'] ?? $config['default_folder'],
            ];
        }

        return [
            'disk' => $config['default'],
            'folder' => $folder ?? $config['default_folder'],
        ];
    }

    public function url(string $path, ?string $disk = null): string
    {
        $disk = $disk ?: $this->getConfig()['default'];
        return Storage::disk($disk)->url($path);
    }

    public function disk(?string $diskName = null): mixed
    {
        return Storage::disk($diskName ?: $this->getConfig()['default']);
    }

    public function getConfig(): array
    {
        return Cache::remember(self::CACHE_KEY, self::CACHE_TTL, function () {
            $raw = AdminSetting::get('storage_rules');
            if ($raw) {
                $decoded = json_decode($raw, true);
                if (is_array($decoded)) return $decoded;
            }

            return $this->defaultConfig();
        });
    }

    public function updateConfig(array $config): void
    {
        AdminSetting::set('storage_rules', json_encode($config));
        Cache::forget(self::CACHE_KEY);
    }

    public function availableDisks(): array
    {
        $configured = [];
        foreach (config('filesystems.disks', []) as $name => $disk) {
            if (str_starts_with($name, 'db_')) continue;
            $configured[] = [
                'name' => $name,
                'driver' => $disk['driver'] ?? 'unknown',
                'label' => $this->diskLabel($name),
            ];
        }

        try {
            $dbProviders = ObjectStorageProvider::where('is_active', true)
                ->orderBy('label')
                ->get(['key', 'label', 'driver']);
            foreach ($dbProviders as $p) {
                $configured[] = [
                    'name' => 'db_' . $p->key,
                    'driver' => $p->driver ?? 's3',
                    'label' => $p->label,
                ];
            }
        } catch (\Throwable $e) {
            // DB table may not exist yet (first deploy)
        }

        return $configured;
    }

    public function defaultConfig(): array
    {
        return [
            'default' => config('filesystems.upload_disk', 'local_uploads'),
            'default_folder' => config('filesystems.upload_folder', 'uploads'),
            'private_disk' => config('filesystems.private_disk', 'local'),
            'rules' => [
                [
                    'label' => 'Images',
                    'mime_pattern' => 'image/*',
                    'disk' => config('filesystems.upload_disk', 'local_uploads'),
                    'folder' => 'images',
                ],
                [
                    'label' => 'Videos',
                    'mime_pattern' => 'video/*',
                    'disk' => config('filesystems.upload_disk', 'local_uploads'),
                    'folder' => 'videos',
                ],
                [
                    'label' => 'Documents',
                    'mime_pattern' => 'application/pdf',
                    'disk' => config('filesystems.upload_disk', 'local_uploads'),
                    'folder' => 'documents',
                ],
            ],
        ];
    }

    public function privateDisk(): string
    {
        $config = $this->getConfig();
        $private = $config['private_disk'] ?? null;
        if ($private && config("filesystems.disks.{$private}")) {
            return $private;
        }
        return config('filesystems.private_disk', 'local');
    }

    private function matchRule(string $mimeType, array $rules): ?array
    {
        foreach ($rules as $rule) {
            $pattern = $rule['mime_pattern'] ?? '';
            if ($pattern === '*') return $rule;
            if (str_contains($pattern, '*')) {
                $prefix = str_replace('*', '', $pattern);
                if (str_starts_with($mimeType, $prefix)) return $rule;
            }
            if ($pattern === $mimeType) return $rule;
        }
        return null;
    }

    private function diskLabel(string $name): string
    {
        return match ($name) {
            'local_uploads' => 'Local Storage',
            's3' => 'Amazon S3',
            'wasabi' => 'Wasabi',
            'bunny' => 'Bunny CDN',
            'contabo' => 'Contabo Object Storage',
            'public' => 'Public Local',
            'local' => 'Private Local',
            default => ucfirst(str_replace('_', ' ', $name)),
        };
    }
}
