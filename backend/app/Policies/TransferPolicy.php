<?php

namespace App\Policies;

use App\Models\Transfer;
use App\Models\User;

class TransferPolicy
{
    public function before(User $user): ?bool
    {
        return $user->role === 'admin' ? true : null;
    }

    public function view(User $user, Transfer $transfer): bool
    {
        return $user->id === $transfer->sender_id || $user->id === $transfer->recipient_id;
    }
}
