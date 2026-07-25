<?php

namespace App\Policies;

use App\Models\Community;
use App\Models\CommunityMembership;
use App\Models\User;

class CommunityMembershipPolicy
{
    public function before(User $user): ?bool
    {
        return $user->role === 'admin' ? true : null;
    }

    public function viewPendingRequests(User $user, Community $community): bool
    {
        return $user->id === $community->user_id;
    }

    public function approve(User $user, CommunityMembership $membership): bool
    {
        return $user->id === $membership->community->user_id;
    }

    public function reject(User $user, CommunityMembership $membership): bool
    {
        return $user->id === $membership->community->user_id;
    }

    public function assignRole(User $user, CommunityMembership $membership): bool
    {
        return $user->id === $membership->community->user_id;
    }
}
