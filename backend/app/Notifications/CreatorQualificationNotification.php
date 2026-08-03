<?php

namespace App\Notifications;

use App\Models\AdminSetting;
use App\Models\CreatorQualificationEvent;
use App\Services\NotificationService;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

class CreatorQualificationNotification extends Notification
{
    use Queueable;

    public function __construct(
        public readonly CreatorQualificationEvent $event,
    ) {}

    public function via(object $notifiable): array
    {
        return ['database'];
    }

    public function toDatabase(object $notifiable): array
    {
        return [
            'type'              => 'creator_qualification',
            'title'             => 'You may qualify as a Creator!',
            'body'              => 'Your combined social following has reached our creator threshold. Start your creator application today.',
            'action_url'        => NotificationService::link('/upgrade/creator'),
            'action_label'      => 'Apply as Creator',
            'qualification_event_id' => $this->event->id,
            'combined_followers' => $this->event->snapshot?->combined_followers,
        ];
    }

    public function databaseType(object $notifiable): string
    {
        return 'creator_qualification';
    }
}
