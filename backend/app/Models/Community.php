<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Laravel\Scout\Searchable;

class Community extends Model
{
    use HasFactory, Searchable, SoftDeletes;

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
        'non_member_can_view',
        'new_member_can_comment_immediately',
        'posts_require_approval',
        'comments_require_moderation',
        'dislikes_enabled',
        'anonymous_posts_allowed',
        'posting_roles',
        'slow_mode_seconds',
    ];

    protected $casts = [
        'rules' => 'array',
        'posting_roles' => 'array',
        'price_amount' => 'decimal:2',
        'members_count' => 'integer',
        'non_member_can_view' => 'boolean',
        'new_member_can_comment_immediately' => 'boolean',
        'posts_require_approval' => 'boolean',
        'comments_require_moderation' => 'boolean',
        'dislikes_enabled' => 'boolean',
        'anonymous_posts_allowed' => 'boolean',
        'slow_mode_seconds' => 'integer',
    ];

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function memberships(): HasMany
    {
        return $this->hasMany(CommunityMembership::class);
    }

    public function members(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'community_memberships')
            ->withPivot('role', 'status')
            ->withTimestamps()
            ->wherePivot('status', 'active');
    }

    public function restrictions(): HasMany
    {
        return $this->hasMany(CommunityMemberRestriction::class);
    }

    public function scopePublicOnly($query)
    {
        return $query->where('visibility', 'public');
    }

    public function scopeByCategory($query, ?string $category)
    {
        if ($category && strtolower($category) !== 'all') {
            return $query->where('category', $category);
        }
        return $query;
    }

    public function toSearchableArray(): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'description' => $this->description,
            'slug' => $this->slug,
        ];
    }
}
