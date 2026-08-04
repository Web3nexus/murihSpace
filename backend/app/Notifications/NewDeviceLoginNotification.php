<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

class NewDeviceLoginNotification extends Notification
{
    use Queueable;

    public function __construct(
        private readonly array $device,
        private readonly string $ip,
    ) {}

    public function via(object $notifiable): array
    {
        return ['database'];
    }

    public function databaseType(object $notifiable): string
    {
        return 'new_device_login';
    }

    public function toDatabase(object $notifiable): array
    {
        return [
            'type' => 'new_device_login',
            'device' => $this->device,
            'ip' => $this->ip,
            'time' => now()->toISOString(),
            'hint' => 'Your account was signed in from a new device. If this was you, no action is needed. Otherwise revoke the session from Settings → Security.',
        ];
    }
}
