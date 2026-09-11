<?php

namespace App\Events;

use App\Models\Call;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class CallAccepted implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public Call $call
    ) {}

    public function broadcastOn(): array
    {
        return [
            new PrivateChannel('call.' . $this->call->room_name),
            new PrivateChannel('user.' . $this->call->caller_id),
            new PrivateChannel('App.Models.User.' . $this->call->caller_id),
        ];
    }

    public function broadcastAs(): string
    {
        return 'call.accepted';
    }

    public function broadcastWith(): array
    {
        return [
            'id' => $this->call->id,
            'status' => $this->call->status,
            'room_name' => $this->call->room_name,
            'started_at' => $this->call->started_at?->toIso8601String(),
        ];
    }
}
