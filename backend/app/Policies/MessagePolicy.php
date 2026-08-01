<?php

namespace App\Policies;

use App\Models\Message;
use App\Models\User;

class MessagePolicy
{
    public function before(User $user): ?bool
    {
        return $user->role === 'admin' ? true : null;
    }

    public function view(User $user, Message $message): bool
    {
        return $message->conversation->participants()
            ->where('user_id', $user->id)
            ->exists();
    }

    public function delete(User $user, Message $message): bool
    {
        if ($message->user_id === $user->id) {
            return true;
        }

        if ($message->conversation->type === 'community' && $message->conversation->community_id) {
            return \App\Models\CommunityMembership::where('community_id', $message->conversation->community_id)
                ->where('user_id', $user->id)
                ->whereIn('role', ['admin', 'moderator'])
                ->exists();
        }

        return false;
    }
}
