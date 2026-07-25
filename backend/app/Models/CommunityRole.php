<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class CommunityRole extends Model
{
    use HasFactory;

    protected $fillable = [
        'community_id',
        'name',
        'slug',
        'permissions',
        'is_system',
        'color',
    ];

    protected $casts = [
        'permissions' => 'array',
        'is_system' => 'boolean',
    ];

    /**
     * Relationship: The community for this role.
     */
    public function community(): BelongsTo
    {
        return $this->belongsTo(Community::class);
    }

    /**
     * Relationship: Memberships holding this role.
     */
    public function memberships(): HasMany
    {
        return $this->hasMany(CommunityMembership::class, 'role_id');
    }

    /**
     * Check if this role includes a specific permission.
     */
    public function hasPermission(string $permission): bool
    {
        if (in_array('*', $this->permissions || [])) {
            return true;
        }

        return in_array($permission, $this->permissions || []);
    }
}
