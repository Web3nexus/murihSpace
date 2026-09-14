<?php

namespace App\Events;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class MessageRead implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public int $conversationId;
    public int $readerId;
    public string $readAt;

    public function __construct(int $conversationId, int $readerId)
    {
        $this->conversationId = $conversationId;
        $this->readerId = $readerId;
        $this->readAt = now()->toIso8601String();
    }

    public function broadcastOn(): array
    {
        $channels = [
            new PrivateChannel('conversation.'.$this->conversationId),
        ];

        // Broadcast to each participant's private channel so read status updates
        // instantly across all tabs, conversation lists, and background clients
        $participantIds = \App\Models\ConversationParticipant::where('conversation_id', $this->conversationId)
            ->pluck('user_id');

        foreach ($participantIds as $userId) {
            $channels[] = new PrivateChannel('user.'.$userId);
        }

        return $channels;
    }

    public function broadcastAs(): string
    {
        return 'MessageRead';
    }

    public function broadcastWith(): array
    {
        return [
            'conversation_id' => $this->conversationId,
            'reader_id' => $this->readerId,
            'read_at' => $this->readAt,
        ];
    }
}
