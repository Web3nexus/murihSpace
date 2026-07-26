<?php

namespace App\Models;

use Database\Factories\UserFactory;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

#[Fillable([
    'name', 'email', 'password', 'username', 'country',
    'mobile_number', 'county', 'state', 'role', 'status', 'kyc_status', 'kyc_document',
    'bio', 'avatar', 'kyc_rejection_reason',
])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable implements MustVerifyEmail
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable;

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
        ];
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
