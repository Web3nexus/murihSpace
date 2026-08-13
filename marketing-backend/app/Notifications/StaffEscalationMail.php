<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Critical staff escalation sent to the configured support email address.
 * Mirrors the main backend's AdminAlertNotification for ticket alerting.
 */
class StaffEscalationMail extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public string $title,
        public string $message,
        public ?string $actionUrl = null,
    ) {}

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $mail = (new MailMessage)
            ->subject('SecureCRM: '.$this->title)
            ->line($this->message);

        if ($this->actionUrl) {
            $mail->action('View Ticket', $this->actionUrl);
        }

        return $mail;
    }
}
