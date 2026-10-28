<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * One end-to-end encryption device for a user, with its public keys only.
 */
class E2eeDevice extends Model
{
    protected $fillable = [
        'user_id',
        'device_uuid',
        'registration_id',
        'identity_key',
        'signed_prekey_id',
        'signed_prekey_public',
        'signed_prekey_signature',
        'kyber_prekey_id',
        'kyber_prekey_public',
        'kyber_prekey_signature',
        'last_seen_at',
    ];

    protected $casts = [
        'registration_id' => 'integer',
        'signed_prekey_id' => 'integer',
        'kyber_prekey_id' => 'integer',
        'last_seen_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function oneTimePrekeys(): HasMany
    {
        return $this->hasMany(E2eeOneTimePrekey::class, 'e2ee_device_id');
    }
}
