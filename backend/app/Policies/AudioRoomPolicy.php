<?php

namespace App\Policies;

use App\Models\AudioRoom;
use App\Models\User;

class AudioRoomPolicy
{
    public function before(User $user): ?bool
    {
        return $user->role === 'admin' ? true : null;
    }

    public function create(User $user): bool
    {
        return $user->isCreatorOrAdmin();
    }

    public function view(User $user, AudioRoom $room): bool
    {
        return true;
    }

    public function update(User $user, AudioRoom $room): bool
    {
        return $user->id === $room->creator_id;
    }

    public function delete(User $user, AudioRoom $room): bool
    {
        return $user->id === $room->creator_id;
    }

    public function start(User $user, AudioRoom $room): bool
    {
        return $user->id === $room->creator_id;
    }

    public function end(User $user, AudioRoom $room): bool
    {
        if ($user->id === $room->creator_id) {
            return true;
        }

        return $room->participants()
            ->where('user_id', $user->id)
            ->where('role', 'co_host')
            ->whereNull('left_at')
            ->exists();
    }

    public function manageParticipants(User $user, AudioRoom $room): bool
    {
        if ($user->id === $room->creator_id) {
            return true;
        }

        return $room->participants()
            ->where('user_id', $user->id)
            ->whereIn('role', ['co_host'])
            ->whereNull('left_at')
            ->exists();
    }
}
