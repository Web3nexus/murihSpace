<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class LiveStreamGiftSent implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public int $streamId,
        public array $gift,
        public array $sender,
        public int $totalCoinsEarned,
        public ?string $message = null,
        public bool $isAnonymous = false,
    ) {}

    public function broadcastOn(): array
    {
        return [
            new Channel('live-stream.' . $this->streamId),
        ];
    }

    public function broadcastAs(): string
    {
        return 'LiveStreamGiftSent';
    }

    public function broadcastWith(): array
    {
        return [
            'stream_id' => $this->streamId,
            'gift' => $this->gift,
            'sender' => $this->sender,
            'total_coins_earned' => $this->totalCoinsEarned,
            'message' => $this->message,
            'is_anonymous' => $this->isAnonymous,
            'timestamp' => now()->timestamp,
        ];
    }
}

