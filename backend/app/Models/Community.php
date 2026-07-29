<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Community extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'user_id',
        'name',
        'slug',
        'description',
        'category',
        'visibility',
        'pricing_type',
        'price_amount',
        'logo_url',
        'cover_url',
        'rules',
        'members_count',
    ];

    protected $casts = [
        'rules' => 'array',
        'price_amount' => 'decimal:2',
        'members_count' => 'integer',
    ];

    /**
     * Relationship: The creator/owner of the community.
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    /**
     * Relationship: Community membership records.
     */
    public function memberships(): HasMany
    {
        return $this->hasMany(CommunityMembership::class);
    }

    /**
     * Relationship: Active members of the community.
     */
    public function members(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'community_memberships')
            ->withPivot('role', 'status')
            ->withTimestamps()
            ->wherePivot('status', 'active');
    }

    /**
     * Scope: Public communities only (for discovery).
     */
    public function scopePublicOnly($query)
    {
        return $query->where('visibility', 'public');
    }

    /**
     * Scope: Filter by category if specified.
     */
    public function scopeByCategory($query, ?string $category)
    {
        if ($category && strtolower($category) !== 'all') {
            return $query->where('category', $category);
        }

        return $query;
    }
}
