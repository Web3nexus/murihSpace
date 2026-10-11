<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class LiveStreamViewerCountUpdated implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public int $streamId,
        public int $viewersCount,
        public int $peakViewers,
    ) {}

    public function broadcastOn(): array
    {
        return [
            new Channel('live-stream.' . $this->streamId),
        ];
    }

    public function broadcastAs(): string
    {
        return 'LiveStreamViewerCountUpdated';
    }

    public function broadcastWith(): array
    {
        return [
            'stream_id' => $this->streamId,
            'viewers_count' => $this->viewersCount,
            'peak_viewers' => $this->peakViewers,
            'timestamp' => now()->timestamp,
        ];
    }
}

