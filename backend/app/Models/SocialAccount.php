<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SocialAccount extends Model
{
    protected $fillable = [
        'user_id',
        'provider',
        'provider_user_id',
        'username',
        'profile_url',
        'follower_count',
        'following_count',
        'verified_on_provider',
        'count_is_self_reported',
        'access_token_reference',
        'connected_at',
        'last_synced_at',
        'sync_status',
        'raw_metadata',
    ];

    protected $casts = [
        'follower_count'        => 'integer',
        'following_count'       => 'integer',
        'verified_on_provider'  => 'boolean',
        'count_is_self_reported' => 'boolean',
        'connected_at'          => 'datetime',
        'last_synced_at'        => 'datetime',
        'raw_metadata'          => 'array',
    ];

    protected $hidden = ['access_token_reference'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** Human-readable provider label */
    public static function providerLabel(string $provider): string
    {
        return match ($provider) {
            'instagram' => 'Instagram',
            'tiktok'    => 'TikTok',
            'youtube'   => 'YouTube',
            'facebook'  => 'Facebook',
            'x'         => 'X (Twitter)',
            'linkedin'  => 'LinkedIn',
            'twitch'    => 'Twitch',
            default     => ucfirst($provider),
        };
    }

    /** Supported providers */
    public static function supportedProviders(): array
    {
        return ['instagram', 'tiktok', 'youtube', 'facebook', 'x', 'linkedin', 'twitch'];
    }
}
