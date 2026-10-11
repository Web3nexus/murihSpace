<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class LiveStreamGuestAction implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public int $streamId,
        public string $action, // 'requested', 'accepted', 'declined', 'invited', 'left', 'removed'
        public array $guest,
        public ?string $livekitRoom = null,
        public ?string $token = null,
    ) {}

    public function broadcastOn(): array
    {
        return [
            new Channel('live-stream.' . $this->streamId),
        ];
    }

    public function broadcastAs(): string
    {
        return 'LiveStreamGuestAction';
    }

    public function broadcastWith(): array
    {
        return [
            'stream_id' => $this->streamId,
            'action' => $this->action,
            'guest' => $this->guest,
            'livekit_room' => $this->livekitRoom,
            'token' => $this->token,
            'timestamp' => now()->timestamp,
        ];
    }
}

