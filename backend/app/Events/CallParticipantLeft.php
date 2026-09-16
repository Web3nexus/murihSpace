<?php

namespace App\Events;

use App\Models\Call;
use App\Models\CallParticipant;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class CallParticipantLeft implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public Call $call,
        public CallParticipant $participant,
        public string $reason = 'left', // 'left' or 'declined'
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
        return 'call.participant.left';
    }

    public function broadcastWith(): array
    {
        return [
            'call_id' => $this->call->id,
            'room_name' => $this->call->room_name,
            'user_id' => $this->participant->user_id,
            'reason' => $this->reason,
        ];
    }
}
