<?php

namespace App\Policies;

use App\Models\DigitalProduct;
use App\Models\User;

class DigitalProductPolicy
{
    public function before(User $user): ?bool
    {
        return $user->role === 'admin' ? true : null;
    }

    public function create(User $user): bool
    {
        return in_array($user->role, ['creator', 'admin']);
    }

    public function view(User $user, DigitalProduct $product): bool
    {
        return $user->id === $product->creator_id;
    }

    public function update(User $user, DigitalProduct $product): bool
    {
        return $user->id === $product->creator_id;
    }

    public function delete(User $user, DigitalProduct $product): bool
    {
        return $user->id === $product->creator_id;
    }

    public function publish(User $user, DigitalProduct $product): bool
    {
        return $user->id === $product->creator_id;
    }
}
