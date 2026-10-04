<?php

namespace App\Events;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * Tells every remaining attendee the host ended the meeting, so each client
 * can tear the session down on an explicit signal rather than by guessing from
 * a failed media connection.
 */
class MeetingEnded implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public string $code,
        public array $meta = [],
    ) {}

    public function broadcastOn(): array
    {
        return [new PrivateChannel('meeting.'.$this->code)];
    }

    public function broadcastAs(): string
    {
        return 'MeetingEnded';
    }

    /**
     * @return array<string, mixed>
     */
    public function broadcastWith(): array
    {
        return ['code' => $this->code] + $this->meta;
    }
}
