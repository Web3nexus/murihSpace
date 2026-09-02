<?php

namespace App\Notifications;

use App\Services\NotificationService;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Str;

class MurihOfficialNotification extends Notification
{
    use Queueable;

    public function __construct(
        public readonly string $type,
        public readonly string $title,
        public readonly string $body,
        public readonly ?string $actionUrl = null,
        public readonly ?string $actionLabel = null,
        public readonly ?string $route = null,
        public readonly array $metadata = [],
    ) {}

    /**
     * Get the notification's delivery channels.
     */
    public function via(object $notifiable): array
    {
        return ['database', 'broadcast'];
    }

    /**
     * Get the array representation of the notification for database storage.
     */
    public function toDatabase(object $notifiable): array
    {
        return [
            'type'            => $this->type,
            'is_official'     => true,
            'sender_name'     => 'Murih Notifications Official',
            'is_verified'     => true,
            'title'           => $this->title,
            'body'            => $this->body,
            'message'         => $this->body,
            'action_url'      => $this->actionUrl,
            'action_label'    => $this->actionLabel,
            'route'           => $this->route,
            'metadata'        => $this->metadata,
            'created_at'      => now()->toIso8601String(),
        ];
    }

    /**
     * Get the array representation for real-time broadcasting via Reverb / WebSockets.
     */
    public function toBroadcast(object $notifiable): array
    {
        return [
            'id'              => (string) Str::uuid(),
            'type'            => $this->type,
            'is_official'     => true,
            'sender_name'     => 'Murih Notifications Official',
            'is_verified'     => true,
            'title'           => $this->title,
            'body'            => $this->body,
            'message'         => $this->body,
            'action_url'      => $this->actionUrl,
            'action_label'    => $this->actionLabel,
            'route'           => $this->route,
            'metadata'        => $this->metadata,
            'created_at'      => now()->toIso8601String(),
        ];
    }

    /**
     * Set custom database notification type.
     */
    public function databaseType(object $notifiable): string
    {
        return $this->type;
    }
}
