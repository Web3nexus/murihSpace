<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A single-use public prekey. Handed out once to a sender who starts a session,
 * then marked as claimed.
 */
class E2eeOneTimePrekey extends Model
{
    protected $fillable = [
        'e2ee_device_id',
        'key_id',
        'public_key',
        'claimed_at',
    ];

    protected $casts = [
        'key_id' => 'integer',
        'claimed_at' => 'datetime',
    ];

    public function device(): BelongsTo
    {
        return $this->belongsTo(E2eeDevice::class, 'e2ee_device_id');
    }
}
