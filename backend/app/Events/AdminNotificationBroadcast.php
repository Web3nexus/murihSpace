<?php

namespace App\Events;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class AdminNotificationBroadcast implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public array $notification,
        public ?int $targetAdminId = null,
        public ?string $category = null,
    ) {}

    public function broadcastOn(): array
    {
        if ($this->targetAdminId) {
            return [
                new PrivateChannel('admin.notifications.' . $this->targetAdminId),
            ];
        }

        // Category is part of the channel name so that subscription itself is
        // authorised. A single shared channel could only be authorised as
        // "is an admin", which would push a category the operator holds no
        // permission for onto their socket — the per-category check in
        // AdminNotificationService::queryFor protects the list endpoint, and
        // this protects the push.
        return [
            new PrivateChannel('admin.notifications.category.'.($this->category ?: 'system_alerts')),
        ];
    }

    public function broadcastWith(): array
    {
        return $this->notification;
    }

    public function broadcastAs(): string
    {
        return 'AdminNotification';
    }
}
