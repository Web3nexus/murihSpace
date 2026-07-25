<?php

namespace App\Policies;

use App\Models\Community;
use App\Models\User;

class CommunityPolicy
{
    public function before(User $user): ?bool
    {
        return $user->role === 'admin' ? true : null;
    }

    public function create(User $user): bool
    {
        return in_array($user->role, ['creator', 'admin']);
    }

    public function update(User $user, Community $community): bool
    {
        return $user->id === $community->user_id;
    }

    public function manageMembers(User $user, Community $community): bool
    {
        if ($user->id === $community->user_id) {
            return true;
        }

        return $community->memberships()
            ->where('user_id', $user->id)
            ->whereIn('role', ['admin', 'moderator'])
            ->where('status', 'active')
            ->exists();
    }

    public function manageRoles(User $user, Community $community): bool
    {
        return $user->id === $community->user_id;
    }
}
