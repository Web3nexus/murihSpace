<?php

namespace App\Events;

use App\Models\Call;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class CallIncoming implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public Call $call
    ) {
        $this->call->loadMissing(['caller:id,name,username,avatar', 'recipient:id,name,username,avatar']);
    }

    public function broadcastOn(): array
    {
        return [
            new PrivateChannel('user.' . $this->call->recipient_id),
            new PrivateChannel('App.Models.User.' . $this->call->recipient_id),
        ];
    }

    public function broadcastAs(): string
    {
        return 'call.incoming';
    }

    public function broadcastWith(): array
    {
        $caller = $this->call->caller;

        return [
            'id' => $this->call->id,
            'caller_id' => $this->call->caller_id,
            'recipient_id' => $this->call->recipient_id,
            'conversation_id' => $this->call->conversation_id,
            'type' => $this->call->type,
            'status' => $this->call->status,
            'room_name' => $this->call->room_name,
            'created_at' => $this->call->created_at?->toIso8601String(),
            'caller' => $caller ? [
                'id' => $caller->id,
                'name' => $caller->name,
                'username' => $caller->username,
                'avatar' => $caller->avatar,
                'avatar_url' => $caller->avatar_url ?? $caller->avatar,
            ] : null,
        ];
    }
}
