<?php

namespace App\Policies;

use App\Models\Storefront;
use App\Models\User;

class StorefrontPolicy
{
    public function before(User $user): ?bool
    {
        return $user->role === 'admin' ? true : null;
    }

    public function view(User $user, Storefront $storefront): bool
    {
        return $user->id === $storefront->user_id;
    }

    public function update(User $user, Storefront $storefront): bool
    {
        return $user->id === $storefront->user_id;
    }

    public function publish(User $user, Storefront $storefront): bool
    {
        return $user->id === $storefront->user_id;
    }
}
