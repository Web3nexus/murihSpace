<?php

namespace App\Notifications;

use Illuminate\Notifications\Notification;

/**
 * In-app staff notification shown in the SecureCRM bell. Data drives the
 * dashboard list + the "ticket" deep link.
 */
class StaffTicketNotification extends Notification
{
    public function __construct(
        public string $type,
        public string $title,
        public string $message,
        public ?string $actionUrl = null,
        public ?string $ticketNumber = null,
    ) {}

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['database'];
    }

    public function toDatabase(object $notifiable): array
    {
        return [
            'type' => $this->type,
            'title' => $this->title,
            'message' => $this->message,
            'action_url' => $this->actionUrl,
            'ticket_number' => $this->ticketNumber,
        ];
    }

    public function databaseType(object $notifiable): string
    {
        return $this->type;
    }
}
