<?php

namespace App\Events;

use App\Models\Call;
use App\Models\CallParticipant;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class CallParticipantJoined implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public Call $call,
        public CallParticipant $participant,
    ) {
        $this->call->loadMissing(['caller:id,name,username,avatar', 'recipient:id,name,username,avatar']);
        $this->participant->loadMissing(['user:id,name,username,avatar']);
    }

    public function broadcastOn(): array
    {
        $channels = [
            new PrivateChannel('call.' . $this->call->room_name),
        ];

        foreach ($this->call->allParticipantUserIds() as $userId) {
            $channels[] = new PrivateChannel('user.' . $userId);
            $channels[] = new PrivateChannel('App.Models.User.' . $userId);
        }

        return $channels;
    }

    public function broadcastAs(): string
    {
        return 'call.participant.joined';
    }

    public function broadcastWith(): array
    {
        $user = $this->participant->user;

        return [
            'call_id' => $this->call->id,
            'room_name' => $this->call->room_name,
            'participant' => [
                'id' => $this->participant->id,
                'user_id' => $this->participant->user_id,
                'status' => $this->participant->status,
                'joined_at' => $this->participant->joined_at?->toIso8601String(),
                'user' => $user ? [
                    'id' => $user->id,
                    'name' => $user->name,
                    'username' => $user->username,
                    'avatar' => $user->avatar_url ?? $user->avatar,
                ] : null,
            ],
        ];
    }
}
