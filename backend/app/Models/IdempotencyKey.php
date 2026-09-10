<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class IdempotencyKey extends Model
{
    protected $fillable = [
        'key',
        'scope',
        'user_id',
        'request_hash',
        'response_status',
        'response_body',
        'locked_until',
    ];

    protected $casts = [
        'response_status' => 'integer',
        'response_body' => 'array',
        'locked_until' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}

