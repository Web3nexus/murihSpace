<?php

namespace App\Models;

use App\Enums\ProviderHealthStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PaymentProvider extends Model
{
    protected $fillable = [
        'code',
        'name',
        'is_enabled',
        'environment',
        'priority',
        'health_status',
        'last_health_check_at',
        'last_successful_request_at',
        'last_failed_request_at',
        'config',
    ];

    protected $casts = [
        'is_enabled' => 'boolean',
        'priority' => 'integer',
        'health_status' => ProviderHealthStatus::class,
        'last_health_check_at' => 'datetime',
        'last_successful_request_at' => 'datetime',
        'last_failed_request_at' => 'datetime',
        'config' => 'array',
    ];

    public function capabilities(): HasMany
    {
        return $this->hasMany(ProviderCapability::class, 'payment_provider_id');
    }

    public function primaryRoutes(): HasMany
    {
        return $this->hasMany(ProviderRoute::class, 'primary_provider_id');
    }

    public function fallbackRoutes(): HasMany
    {
        return $this->hasMany(ProviderRoute::class, 'fallback_provider_id');
    }

    public function isAvailable(): bool
    {
        return $this->is_enabled && $this->health_status !== ProviderHealthStatus::Down;
    }
}

