<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CommunityMembership extends Model
{
    use HasFactory;

    protected $fillable = [
        'community_id',
        'user_id',
        'role',
        'role_id',
        'status',
    ];

    /**
     * Relationship: The community associated with this membership.
     */
    public function community(): BelongsTo
    {
        return $this->belongsTo(Community::class);
    }

    /**
     * Relationship: The user/member.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Relationship: Custom community role.
     */
    public function customRole(): BelongsTo
    {
        return $this->belongsTo(CommunityRole::class, 'role_id');
    }

    /**
     * Scope: Active memberships only.
     */
    public function scopeActiveOnly($query)
    {
        return $query->where('status', 'active');
    }

    /**
     * Scope: Pending requests only.
     */
    public function scopePendingOnly($query)
    {
        return $query->where('status', 'pending');
    }
}
