<?php

namespace App\Policies;

use App\Models\Donation;
use App\Models\User;

class DonationPolicy
{
    public function before(User $user): ?bool
    {
        return $user->role === 'admin' ? true : null;
    }

    public function view(User $user, Donation $donation): bool
    {
        return $user->id === $donation->sender_id || $user->id === $donation->recipient_id;
    }
}
