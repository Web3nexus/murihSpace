<?php

namespace App\Notifications;

use App\Models\Media;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

class MediaExpiryNotification extends Notification
{
    use Queueable;

    public function __construct(
        public Media $media,
    ) {}

    public function via(object $notifiable): array
    {
        return ['database', 'broadcast'];
    }

    public function toDatabase(object $notifiable): array
    {
        return [
            'type' => 'media_expiry',
            'media_id' => $this->media->id,
            'expires_at' => $this->media->delete_after?->toIso8601String(),
            'remaining_days' => max(0, (int) ceil(now()->diffInDays($this->media->delete_after))),
        ];
    }

    public function toBroadcast(object $notifiable): array
    {
        return [
            'type' => 'media_expiry',
            'media_id' => $this->media->id,
            'expires_at' => $this->media->delete_after?->toIso8601String(),
            'remaining_days' => max(0, (int) ceil(now()->diffInDays($this->media->delete_after))),
        ];
    }

    public function databaseType(object $notifiable): string
    {
        return 'media_expiry';
    }
}
