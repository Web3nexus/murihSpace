<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UserWarning extends Model
{
    public const CATEGORIES = ['conduct', 'spam', 'harassment', 'hate', 'fraud', 'content'];

    protected $fillable = [
        'user_id',
        'issued_by',
        'reason',
        'category',
        'expires_at',
        'acknowledged_at',
        'revoked_at',
        'revoked_by',
        'ban_id',
    ];

    protected $casts = [
        'issued_at' => 'datetime',
        'expires_at' => 'datetime',
        'acknowledged_at' => 'datetime',
        'revoked_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function issuer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'issued_by');
    }

    /**
     * A warning counts toward the ban gate while it is neither revoked nor past
     * its expiry. A warning with no expiry never lapses.
     */
    public function isActive(): bool
    {
        if ($this->revoked_at !== null) {
            return false;
        }

        return $this->expires_at === null || $this->expires_at->isFuture();
    }
}
