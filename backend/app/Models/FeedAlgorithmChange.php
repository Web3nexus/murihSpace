<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FeedAlgorithmChange extends Model
{
    use HasFactory;

    protected $fillable = [
        'admin_id', 'action', 'feed_type', 'signal_name',
        'previous_weight', 'new_weight', 'previous_active', 'new_active',
        'reason', 'is_temporary', 'expires_at',
    ];

    protected $casts = [
        'previous_weight' => 'decimal:4',
        'new_weight' => 'decimal:4',
        'previous_active' => 'boolean',
        'new_active' => 'boolean',
        'is_temporary' => 'boolean',
        'expires_at' => 'datetime',
    ];

    public function admin(): BelongsTo
    {
        return $this->belongsTo(User::class, 'admin_id');
    }

    public function subject()
    {
        return $this->morphTo();
    }
}
