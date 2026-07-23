<?php

namespace App\Events;

use App\Models\Message;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class MessageSent implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public Message $message;

    public function __construct(Message $message)
    {
        $this->message = $message;
    }

    public function broadcastOn(): array
    {
        return [
            new PrivateChannel('conversation.' . $this->message->conversation_id),
        ];
    }

    public function broadcastWith(): array
    {
        return [
            'id'              => $this->message->id,
            'conversation_id' => $this->message->conversation_id,
            'user_id'         => $this->message->user_id,
            'content'         => $this->message->content,
            'type'            => $this->message->type,
            'client_uuid'     => $this->message->client_uuid,
            'created_at'      => $this->message->created_at->toISOString(),
            'user'            => [
                'id'         => $this->message->user->id ?? null,
                'name'       => $this->message->user->name ?? null,
                'username'   => $this->message->user->username ?? null,
                'avatar_url' => $this->message->user->avatar_url ?? null,
            ],
        ];
    }
}
