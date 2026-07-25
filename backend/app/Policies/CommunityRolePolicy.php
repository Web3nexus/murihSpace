<?php

namespace App\Policies;

use App\Models\Community;
use App\Models\User;

class CommunityRolePolicy
{
    public function before(User $user): ?bool
    {
        return $user->role === 'admin' ? true : null;
    }

    public function create(User $user, Community $community): bool
    {
        return $user->id === $community->user_id;
    }
}
