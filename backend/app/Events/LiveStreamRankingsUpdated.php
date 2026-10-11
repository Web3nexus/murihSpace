<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class LiveStreamRankingsUpdated implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public int $streamId,
        public array $topGifters,
        public array $topEngagers,
    ) {}

    public function broadcastOn(): array
    {
        return [
            new Channel('live-stream.' . $this->streamId),
        ];
    }

    public function broadcastAs(): string
    {
        return 'LiveStreamRankingsUpdated';
    }

    public function broadcastWith(): array
    {
        return [
            'stream_id' => $this->streamId,
            'top_gifters' => $this->topGifters,
            'top_engagers' => $this->topEngagers,
            'timestamp' => now()->timestamp,
        ];
    }
}

