<?php

namespace App\Events;

use App\Models\ConversationParticipant;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class TypingIndicator implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public int $conversationId;

    public int $userId;

    public string $userName;

    public bool $isTyping;

    public function __construct(int $conversationId, int $userId, string $userName, bool $isTyping)
    {
        $this->conversationId = $conversationId;
        $this->userId = $userId;
        $this->userName = $userName;
        $this->isTyping = $isTyping;
    }

    public function broadcastOn(): array
    {
        $channels = [
            new PrivateChannel('conversation.'.$this->conversationId),
        ];

        // Also broadcast to each participant's personal channel
        $participantIds = ConversationParticipant::where('conversation_id', $this->conversationId)
            ->where('user_id', '!=', $this->userId)
            ->pluck('user_id');

        foreach ($participantIds as $pId) {
            $channels[] = new PrivateChannel('user.'.$pId);
        }

        return $channels;
    }

    public function broadcastAs(): string
    {
        return 'typing';
    }

    public function broadcastWith(): array
    {
        return [
            'conversation_id' => $this->conversationId,
            'user_id' => $this->userId,
            'user_name' => $this->userName,
            'is_typing' => $this->isTyping,
        ];
    }
}
