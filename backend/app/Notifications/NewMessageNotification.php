<?php

namespace App\Notifications;

use App\Models\Conversation;
use App\Models\Message;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

class NewMessageNotification extends Notification
{
    use Queueable;

    public function __construct(
        public Message $message,
        public Conversation $conversation,
        public User $sender,
    ) {}

    public function via(object $notifiable): array
    {
        return ['database', 'broadcast'];
    }

    public function toDatabase(object $notifiable): array
    {
        return [
            'type' => 'new_message',
            'conversation_id' => $this->conversation->id,
            'conversation_type' => $this->conversation->type,
            'message_id' => $this->message->id,
            'message_preview' => mb_substr($this->message->content ?? '(attachment)', 0, 120),
            'sender_id' => $this->sender->id,
            'sender_name' => $this->sender->name,
            'sender_username' => $this->sender->username,
            'sender_avatar' => $this->sender->avatar_url,
        ];
    }

    public function toBroadcast(object $notifiable): array
    {
        return [
            'type' => 'new_message',
            'conversation_id' => $this->conversation->id,
            'conversation_type' => $this->conversation->type,
            'message_id' => $this->message->id,
            'message_preview' => mb_substr($this->message->content ?? '(attachment)', 0, 120),
            'sender_id' => $this->sender->id,
            'sender_name' => $this->sender->name,
            'sender_username' => $this->sender->username,
            'sender_avatar' => $this->sender->avatar_url,
        ];
    }

    public function databaseType(object $notifiable): string
    {
        return 'new_message';
    }

    public function broadcastType(): string
    {
        return 'new_message';
    }
}
