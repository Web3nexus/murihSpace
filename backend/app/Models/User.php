<?php

namespace App\Models;

use Database\Factories\UserFactory;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use Laravel\Scout\Searchable;

#[Fillable([
    'name', 'email', 'password', 'username', 'country',
    'mobile_number', 'county', 'state', 'role', 'admin_role', 'admin_permissions', 'status',
    'bio', 'avatar', 'avatar_url',
    'kyc_status', 'kyc_document', 'kyc_rejection_reason', 'kyc_provider', 'sumsub_applicant_id',
    'verification_badge_status', 'verification_badge_expires_at',
    'verification_badge_purchased_at', 'verification_badge_auto_renew',
    'two_factor_secret', 'two_factor_recovery_codes', 'two_factor_confirmed_at',
])]
#[Hidden(['password', 'remember_token', 'provider_id', 'kyc_document', 'kyc_rejection_reason', 'username_trial_ends_at', 'two_factor_secret', 'two_factor_recovery_codes'])]
class User extends Authenticatable implements MustVerifyEmail
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable, Searchable, SoftDeletes;

    /**
     * @var list<string>
     */
    protected $appends = ['has_active_verification_badge'];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'username_trial_ends_at' => 'datetime',
            'is_premium' => 'boolean',
            'admin_permissions' => 'array',
            'two_factor_confirmed_at' => 'datetime',
            'verification_badge_expires_at' => 'datetime',
            'verification_badge_purchased_at' => 'datetime',
            'verification_badge_auto_renew' => 'boolean',
        ];
    }

    public function hasActiveUsernameTrial(): bool
    {
        if ($this->is_premium) return true;
        if (! $this->username_trial_ends_at) return false;
        return $this->username_trial_ends_at->isFuture();
    }

    public function getLinkInBioUrl(): string
    {
        if ($this->hasActiveUsernameTrial() && $this->username) {
            return "@{$this->username}";
        }
        return "s/" . base_convert((string) $this->id, 10, 36);
    }

    public function isAdmin(): bool
    {
        return $this->role === 'admin';
    }

    public function isSuperAdmin(): bool
    {
        return $this->isAdmin() && $this->admin_role === 'super_admin';
    }

    public function hasAdminPermission(string $permission): bool
    {
        if (! $this->isAdmin()) return false;
        if ($this->isSuperAdmin()) return true;
        return in_array($permission, $this->admin_permissions ?? [], true);
    }

    public function isCreator(): bool
    {
        return $this->role === 'creator';
    }

    public function isVendor(): bool
    {
        return $this->role === 'vendor';
    }

    public function isMember(): bool
    {
        return $this->role === 'member';
    }

    public function hasVerifiedKyc(): bool
    {
        return $this->kyc_status === 'verified';
    }

    public function hasActiveVerificationBadge(): bool
    {
        if ($this->verification_badge_status !== 'active') {
            return false;
        }
        if ($this->verification_badge_expires_at === null) {
            return true;
        }
        return $this->verification_badge_expires_at->isFuture();
    }

    public function getHasActiveVerificationBadgeAttribute(): bool
    {
        return $this->hasActiveVerificationBadge();
    }

    public function hasRole(string $role): bool
    {
        return $this->role === $role;
    }

    public function isCreatorOrAdmin(): bool
    {
        return in_array($this->role, ['creator', 'admin']);
    }

    public function follows(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'follows', 'follower_id', 'following_id')
            ->withTimestamps();
    }

    public function followers(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'follows', 'following_id', 'follower_id')
            ->withTimestamps();
    }

    public function communities(): BelongsToMany
    {
        return $this->belongsToMany(Community::class, 'community_memberships')
            ->withPivot('role', 'status')
            ->withTimestamps()
            ->wherePivot('status', 'active');
    }

    public function adCampaigns(): HasMany
    {
        return $this->hasMany(AdCampaign::class);
    }

    public function wallet(): HasOne
    {
        return $this->hasOne(Wallet::class);
    }

    public function creatorProfile(): HasOne
    {
        return $this->hasOne(CreatorProfile::class);
    }

    public function aiSetting(): HasOne
    {
        return $this->hasOne(AiSetting::class);
    }

    public function aiMemories(): HasMany
    {
        return $this->hasMany(AiMemory::class);
    }

    public function aiConversations(): HasMany
    {
        return $this->hasMany(AiConversation::class);
    }

    public function linkInBioSocials(): HasMany
    {
        return $this->hasMany(LinkInBioSocialLink::class);
    }

    public function toSearchableArray(): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'username' => $this->username,
            'bio' => $this->bio,
        ];
    }
}
