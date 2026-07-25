<?php

namespace App\Policies;

use App\Models\User;
use App\Models\WithdrawalRequest;

class WithdrawalRequestPolicy
{
    public function before(User $user): ?bool
    {
        return $user->role === 'admin' ? true : null;
    }

    public function view(User $user, WithdrawalRequest $withdrawal): bool
    {
        return $user->id === $withdrawal->user_id;
    }
}
