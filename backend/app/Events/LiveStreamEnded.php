<?php

namespace App\Events;

use App\Models\LiveStream;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class LiveStreamEnded implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public LiveStream $stream,
        public array $summary = [],
    ) {}

    public function broadcastOn(): array
    {
        // Public room channel so every viewer (including guests watching
        // through a share link) is told to close the live when the host ends it.
        return [
            new Channel('live-stream.'.$this->stream->id),
        ];
    }

    public function broadcastWith(): array
    {
        return [
            'stream' => [
                'id' => $this->stream->id,
                'tracking_id' => $this->stream->tracking_id,
                'title' => $this->stream->title,
                'status' => $this->stream->status,
                'started_at' => $this->stream->started_at?->toIso8601String(),
                'ended_at' => $this->stream->ended_at?->toIso8601String(),
            ],
            'summary' => $this->summary,
        ];
    }
}