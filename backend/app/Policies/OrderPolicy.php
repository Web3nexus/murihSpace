<?php

namespace App\Policies;

use App\Models\Order;
use App\Models\User;

class OrderPolicy
{
    public function before(User $user): ?bool
    {
        return $user->role === 'admin' ? true : null;
    }

    public function view(User $user, Order $order): bool
    {
        return $user->id === $order->buyer_id || $user->id === $order->creator_id;
    }

    public function viewReceipt(User $user, Order $order): bool
    {
        return $user->id === $order->buyer_id || $user->id === $order->creator_id;
    }
}
