<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

class WebhookSubscription extends Model
{
    protected $fillable = [
        'subscription_id',
        'developer_app_id',
        'url',
        'events',
        'secret',
        'is_active',
    ];

    protected $casts = [
        'events'    => 'array',
        'is_active' => 'boolean',
    ];

    protected $hidden = [
        'secret',
    ];

    protected static function boot()
    {
        parent::boot();

        static::creating(function ($sub) {
            if (empty($sub->subscription_id)) {
                $sub->subscription_id = 'whk_' . Str::random(16);
            }
            if (empty($sub->secret)) {
                $sub->secret = 'whsec_' . Str::random(32);
            }
        });
    }

    public function developerApp(): BelongsTo
    {
        return $this->belongsTo(DeveloperApp::class);
    }
}
