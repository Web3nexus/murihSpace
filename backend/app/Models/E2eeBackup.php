<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * An encrypted copy of a user's end-to-end encryption device state. Only
 * ciphertext and the parameters needed to derive the key are stored; the
 * passphrase and the plaintext never reach the server.
 */
class E2eeBackup extends Model
{
    protected $fillable = [
        'user_id',
        'version',
        'salt',
        'iv',
        'iterations',
        'ciphertext',
    ];

    protected $casts = [
        'version' => 'integer',
        'iterations' => 'integer',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
