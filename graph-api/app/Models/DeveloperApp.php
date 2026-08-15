<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

class DeveloperApp extends Model
{
    protected $fillable = [
        'app_id',
        'name',
        'description',
        'client_id',
        'client_secret',
        'redirect_uris',
        'allowed_scopes',
        'user_id',
        'status',
    ];

    protected $casts = [
        'redirect_uris'  => 'array',
        'allowed_scopes' => 'array',
    ];

    protected $hidden = [
        'client_secret',
    ];

    protected static function boot()
    {
        parent::boot();

        static::creating(function ($app) {
            if (empty($app->app_id)) {
                $app->app_id = 'app_' . Str::random(16);
            }
            if (empty($app->client_id)) {
                $app->client_id = 'client_' . Str::random(24);
            }
            if (empty($app->client_secret)) {
                $app->client_secret = 'sec_' . Str::random(32);
            }
        });
    }

    public function webhooks(): HasMany
    {
        return $this->hasMany(WebhookSubscription::class);
    }
}
