<?php

namespace App\Events;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class MessageDelivered implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public int $conversationId;
    public array $messageIds;
    public string $deliveredAt;

    public function __construct(int $conversationId, array $messageIds)
    {
        $this->conversationId = $conversationId;
        $this->messageIds = $messageIds;
        $this->deliveredAt = now()->toIso8601String();
    }

    public function broadcastOn(): array
    {
        return [
            new PrivateChannel('conversation.'.$this->conversationId),
        ];
    }

    public function broadcastWith(): array
    {
        return [
            'conversation_id' => $this->conversationId,
            'message_ids' => $this->messageIds,
            'delivered_at' => $this->deliveredAt,
        ];
    }
}
