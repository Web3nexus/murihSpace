<?php

namespace App\Models;

use Database\Factories\UserFactory;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

#[Fillable([
    'name', 'email', 'password', 'username', 'country',
    'mobile_number', 'county', 'state', 'role', 'status',
    'bio', 'avatar', 'avatar_url',
])]
#[Hidden(['password', 'remember_token', 'provider_id', 'kyc_document', 'kyc_rejection_reason', 'username_trial_ends_at'])]
class User extends Authenticatable implements MustVerifyEmail
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable, SoftDeletes;

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

    public function hasRole(string $role): bool
    {
        return $this->role === $role;
    }

    public function isCreatorOrAdmin(): bool
    {
        return in_array($this->role, ['creator', 'admin']);
    }
}
