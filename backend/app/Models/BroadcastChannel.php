<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class BroadcastChannel extends Model
{
    use HasFactory;

    public const LINKED_PAGE = 'page';
    public const LINKED_GROUP = 'group';
    public const LINKED_COMMUNITY = 'community';

    protected $fillable = [
        'user_id',
        'name',
        'handle',
        'description',
        'allow_replies',
        'linked_type',
        'linked_id',
        'recipients_count',
    ];

    protected $casts = [
        'allow_replies' => 'boolean',
        'recipients_count' => 'integer',
    ];

    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function members(): HasMany
    {
        return $this->hasMany(BroadcastChannelMember::class)->where('status', 'active');
    }

    public function linkedGroup(): BelongsTo
    {
        return $this->belongsTo(Group::class, 'linked_id');
    }

    public function linkedCommunity(): BelongsTo
    {
        return $this->belongsTo(Community::class, 'linked_id');
    }

    public function isOwner(?int $userId): bool
    {
        return $userId !== null && (int) $this->user_id === (int) $userId;
    }
}