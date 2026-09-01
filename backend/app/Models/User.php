<?php

namespace App\Models;

use Database\Factories\UserFactory;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Str;
use Laravel\Sanctum\HasApiTokens;
use Laravel\Scout\Searchable;
use App\Services\PermissionService;

#[Fillable([
    'uuid', 'name', 'email', 'password', 'username', 'country',
    'mobile_number', 'birthday', 'county', 'state', 'role', 'admin_role', 'admin_permissions', 'status',
    'bio', 'avatar', 'avatar_url', 'banner_url',
    'kyc_status', 'kyc_document', 'kyc_rejection_reason', 'kyc_provider', 'sumsub_applicant_id',
    'kyc_verification_id',
    'verification_badge_status', 'verification_badge_expires_at',
    'verification_badge_purchased_at', 'verification_badge_auto_renew',
    'two_factor_secret', 'two_factor_recovery_codes', 'two_factor_confirmed_at',
    'provider', 'provider_id', 'email_verify_code_hash', 'email_verify_code_expires_at',
    'phone_verified_at',
])]
#[Hidden(['password', 'remember_token', 'provider_id', 'kyc_document', 'kyc_rejection_reason', 'username_trial_ends_at', 'two_factor_secret', 'two_factor_recovery_codes'])]
class User extends Authenticatable implements MustVerifyEmail
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable, Searchable, SoftDeletes;

    /**
     * @var list<string>
     */
    protected $appends = ['has_active_verification_badge', 'avatar_url'];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'birthday' => 'date:Y-m-d',
            'password' => 'hashed',
            'username_trial_ends_at' => 'datetime',
            'is_premium' => 'boolean',
            'admin_permissions' => 'array',
            'two_factor_confirmed_at' => 'datetime',
            'email_verify_code_expires_at' => 'datetime',
            'phone_verified_at' => 'datetime',
            'verification_badge_expires_at' => 'datetime',
            'verification_badge_purchased_at' => 'datetime',
            'verification_badge_auto_renew' => 'boolean',
        ];
    }

    /**
     * Set the user's email attribute, converting empty strings to null.
     */
    protected function setEmailAttribute(?string $value): void
    {
        $value = is_string($value) ? trim($value) : null;
        $this->attributes['email'] = ($value !== null && $value !== '') ? strtolower($value) : null;
    }

    public function hasActiveUsernameTrial(): bool
    {
        if ($this->is_premium) return true;
        if ($this->username) return true;
        return false;
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
        // Support both 'member' and legacy 'user' role values
        return in_array($this->role, ['member', 'user'], true);
    }

    /**
     * Check if this user holds a platform permission.
     * Admins hold all permissions.
     */
    public function can($abilities, $arguments = []): bool
    {
        if ($this->role === 'admin') {
            return true;
        }

        if (is_string($abilities)) {
            if (PermissionService::roleHas($this->role, $abilities)) {
                return true;
            }
        }

        return parent::can($abilities, $arguments);
    }

    /**
     * Return all platform permissions held by this user.
     */
    public function permissions(): array
    {
        if ($this->role === 'admin') {
            return array_keys(PermissionService::all());
        }

        return PermissionService::permissionsFor($this->role);
    }

    public function hasVerifiedKyc(): bool
    {
        return $this->kyc_status === 'verified';
    }

    public function hasVerifiedEmail()
    {
        return ! is_null($this->email_verified_at) || ! is_null($this->phone_verified_at);
    }

    public function hasVerifiedPhone(): bool
    {
        return $this->phone_verified_at !== null;
    }

    protected static function booted(): void
    {
        static::creating(function (User $user) {
            if ($user->uuid === null) {
                $user->uuid = (string) Str::uuid();
            }
        });
    }

    public function kycVerification(): BelongsTo
    {
        return $this->belongsTo(KycVerification::class);
    }

    public function kycVerifications(): HasMany
    {
        return $this->hasMany(KycVerification::class)->latest('id');
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

    public function getAvatarUrlAttribute(): ?string
    {
        return $this->attributes['avatar'] ?? null;
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

    public function posts(): HasMany
    {
        return $this->hasMany(Post::class);
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

    public function socialAccounts(): HasMany
    {
        return $this->hasMany(SocialAccount::class);
    }

    public function qualificationEvents(): HasMany
    {
        return $this->hasMany(CreatorQualificationEvent::class);
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
