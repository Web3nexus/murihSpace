<?php

namespace App\Policies;

use App\Models\User;

class FeatureFlagPolicy
{
    public function before(User $user): ?bool
    {
        return $user->role === 'admin' ? true : false;
    }
}
