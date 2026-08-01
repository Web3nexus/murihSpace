<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Crypt;

class ObjectStorageProvider extends Model
{
    protected $fillable = [
        'key', 'label', 'driver',
        'access_key', 'secret_key',
        'region', 'bucket', 'endpoint', 'url',
        'use_path_style_endpoint', 'is_active',
    ];

    protected $casts = [
        'use_path_style_endpoint' => 'boolean',
        'is_active' => 'boolean',
    ];

    protected $hidden = ['secret_key'];

    public function setSecretKeyAttribute(string $value): void
    {
        $this->attributes['secret_key'] = Crypt::encryptString($value);
    }

    public function getSecretKeyAttribute(?string $value): ?string
    {
        if ($value === null) return null;
        try {
            return Crypt::decryptString($value);
        } catch (\Exception) {
            return $value;
        }
    }

    public function toDiskConfig(): array
    {
        return [
            'driver' => $this->driver ?? 's3',
            'key' => $this->access_key,
            'secret' => $this->secret_key,
            'region' => $this->region ?? 'us-east-1',
            'bucket' => $this->bucket,
            'endpoint' => $this->endpoint,
            'url' => $this->url,
            'use_path_style_endpoint' => $this->use_path_style_endpoint ?? true,
            'throw' => false,
            'report' => false,
        ];
    }
}
