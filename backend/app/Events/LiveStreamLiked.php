<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class LiveStreamLiked implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public int $streamId,
        public int $count,
        public int $totalLikes,
        public ?array $sender = null,
    ) {}

    public function broadcastOn(): array
    {
        return [
            new Channel('live-stream.' . $this->streamId),
        ];
    }

    public function broadcastAs(): string
    {
        return 'LiveStreamLiked';
    }

    public function broadcastWith(): array
    {
        return [
            'stream_id' => $this->streamId,
            'count' => $this->count,
            'total_likes' => $this->totalLikes,
            'sender' => $this->sender,
            'timestamp' => now()->timestamp,
        ];
    }
}

