<?php

namespace App\Policies;

use App\Models\Event;
use App\Models\User;

class EventPolicy
{
    public function before(User $user): ?bool
    {
        return $user->role === 'admin' ? true : null;
    }

    public function create(User $user): bool
    {
        return in_array($user->role, ['creator', 'admin']);
    }

    public function view(User $user, Event $event): bool
    {
        return true;
    }

    public function update(User $user, Event $event): bool
    {
        return $user->id === $event->creator_id;
    }

    public function delete(User $user, Event $event): bool
    {
        return $user->id === $event->creator_id;
    }

    public function publish(User $user, Event $event): bool
    {
        return $user->id === $event->creator_id;
    }

    public function viewRegistrations(User $user, Event $event): bool
    {
        return $user->id === $event->creator_id;
    }

    public function checkIn(User $user, Event $event): bool
    {
        return $user->id === $event->creator_id;
    }
}
