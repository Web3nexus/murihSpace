<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;

class Group extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'name',
        'slug',
        'description',
        'avatar_url',
        'cover_url',
        'category',
        'privacy',
        'discoverability',
        'rules',
        'tags',
        'website',
        'location',
        'creator_id',
        'members_count',
        'posts_count',
    ];

    protected $casts = [
        'tags' => 'array',
        'members_count' => 'integer',
        'posts_count' => 'integer',
    ];

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'creator_id');
    }

    public function members(): HasMany
    {
        return $this->hasMany(GroupMember::class);
    }

    public function activeMembers(): HasMany
    {
        return $this->hasMany(GroupMember::class)->where('status', 'active');
    }

    public function joinRequests(): HasMany
    {
        return $this->hasMany(GroupJoinRequest::class);
    }

    public function invitations(): HasMany
    {
        return $this->hasMany(GroupInvitation::class);
    }

    public function settings(): HasOne
    {
        return $this->hasOne(GroupSetting::class);
    }

    public function posts(): HasMany
    {
        return $this->hasMany(Post::class)->latest();
    }

    public function conversation(): HasOne
    {
        return $this->hasOne(Conversation::class)->where('type', 'group');
    }

    public function membership(?int $userId): ?GroupMember
    {
        if (!$userId) return null;
        return $this->members()->where('user_id', $userId)->first();
    }

    public function isMember(?int $userId): bool
    {
        if (!$userId) return false;
        return $this->members()
            ->where('user_id', $userId)
            ->where('status', 'active')
            ->exists();
    }

    public function roleOf(?int $userId): ?string
    {
        if (!$userId) return null;
        if ((int)$this->creator_id === (int)$userId) return 'owner';
        return $this->members()
            ->where('user_id', $userId)
            ->where('status', 'active')
            ->value('role');
    }

    public function isAdminOrOwner(?int $userId): bool
    {
        if (!$userId) return false;
        if ((int)$this->creator_id === (int)$userId) return true;
        return $this->members()
            ->where('user_id', $userId)
            ->where('status', 'active')
            ->whereIn('role', ['owner', 'admin'])
            ->exists();
    }

    public function isModeratorOrAbove(?int $userId): bool
    {
        if (!$userId) return false;
        if ((int)$this->creator_id === (int)$userId) return true;
        return $this->members()
            ->where('user_id', $userId)
            ->where('status', 'active')
            ->whereIn('role', ['owner', 'admin', 'moderator'])
            ->exists();
    }

    public function canPost(?int $userId): bool
    {
        if (!$this->isMember($userId)) return false;
        $settings = $this->settings;
        if ($settings && $settings->who_can_post === 'admins_only') {
            return $this->isAdminOrOwner($userId);
        }
        return true;
    }

    public function canChat(?int $userId): bool
    {
        if (!$this->isMember($userId)) return false;
        $member = $this->membership($userId);
        if ($member && $member->muted_until && $member->muted_until->isFuture()) {
            return false;
        }
        $settings = $this->settings;
        if ($settings && $settings->who_can_chat === 'admins_only') {
            return $this->isAdminOrOwner($userId);
        }
        return true;
    }
}
