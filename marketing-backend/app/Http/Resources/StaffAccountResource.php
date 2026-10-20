<?php

namespace App\Http\Resources;

use App\Models\StaffUser;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Staff account as returned by the API. Never includes the password hash,
 * the two-factor secret, or remember tokens.
 *
 * @mixin StaffUser
 */
class StaffAccountResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'role' => $this->role,
            'status' => $this->status,
            'permissions' => $this->permissions,
            'effective_permissions' => $this->allPermissions(),
            'has_two_factor' => $this->hasTwoFactor(),
            'last_login_at' => $this->last_login_at?->toIso8601String(),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
