<?php

namespace App\Policies;

use App\Models\Purchase;
use App\Models\User;

class PurchasePolicy
{
    public function before(User $user): ?bool
    {
        return $user->role === 'admin' ? true : null;
    }

    public function view(User $user, Purchase $purchase): bool
    {
        return $user->id === $purchase->user_id;
    }

    public function download(User $user, Purchase $purchase): bool
    {
        return $user->id === $purchase->user_id;
    }
}
