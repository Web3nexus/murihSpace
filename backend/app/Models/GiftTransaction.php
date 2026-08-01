<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class GiftTransaction extends Model
{
    use HasFactory;

    protected $fillable = [
        'sender_id', 'recipient_id', 'gift_id', 'giftable_type', 'giftable_id',
        'coin_price',
        'creator_earns', 'platform_commission', 'currency', 'status',
        'is_anonymous', 'sender_display_name', 'message', 'is_public',
        'idempotency_key',
    ];

    protected $casts = [
        'is_anonymous' => 'boolean',
        'is_public' => 'boolean',
        'coin_price' => 'integer',
        'creator_earns' => 'integer',
        'platform_commission' => 'integer',
    ];

    public function sender(): BelongsTo
    {
        return $this->belongsTo(User::class, 'sender_id');
    }

    public function recipient(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recipient_id');
    }

    public function gift(): BelongsTo
    {
        return $this->belongsTo(Gift::class);
    }

    public function giftable()
    {
        return $this->morphTo();
    }
}
