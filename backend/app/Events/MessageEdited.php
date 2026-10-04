<?php

namespace App\Events;

use App\Models\Message;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * Broadcast when a sender corrects their own message so other open clients
 * update in place instead of showing a stale copy until they refetch.
 *
 * The prior text is deliberately *not* broadcast: recipients are told the
 * current content and that it was edited, while the full revision chain stays
 * available to moderators through the audit archive.
 */
class MessageEdited implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public Message $message,
        public int $editorId,
    ) {}

    public function broadcastOn(): array
    {
        return [
            new PrivateChannel('conversation.'.$this->message->conversation_id),
        ];
    }

    public function broadcastAs(): string
    {
        return 'MessageEdited';
    }

    public function broadcastWith(): array
    {
        return [
            'id' => $this->message->id,
            'conversation_id' => $this->message->conversation_id,
            'user_id' => $this->message->user_id,
            'editor_id' => $this->editorId,
            'content' => $this->message->content,
            'type' => $this->message->type,
            'edited_at' => $this->message->edited_at?->toISOString(),
            'edit_count' => (int) ($this->message->edit_count ?? 0),
        ];
    }
}