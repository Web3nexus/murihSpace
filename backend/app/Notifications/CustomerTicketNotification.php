<?php

namespace App\Notifications;

use App\Models\NotificationPreference;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class CustomerTicketNotification extends Notification
{
    use Queueable;

    public function __construct(
        public string $type,
        public string $title,
        public string $message,
        public ?string $actionUrl = null,
        public ?string $ticketNumber = null,
    ) {}

    /**
     * Deliver in-app always; email only when the customer has enabled the
     * email channel for this notification type ("email where enabled").
     *
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        $channels = ['database'];

        if ($this->preferenceEnabled($notifiable, 'email')) {
            $channels[] = 'mail';
        }

        return $channels;
    }

    /**
     * In-app payload. The `type` key drives the icon/label in the frontend
     * notification feed and the preference toggles.
     */
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

    public function toMail(object $notifiable): MailMessage
    {
        $mail = (new MailMessage)
            ->subject(sprintf('[%s] %s', config('app.name', 'MurihSpace'), $this->title))
            ->greeting('Hi '.($notifiable->name ?: 'there').',')
            ->line($this->message);

        if ($this->actionUrl) {
            $mail->action('View Ticket', $this->actionUrl);
        }

        $mail->line('Thanks for reaching out — the MurihSpace support team.');

        return $mail;
    }

    public function databaseType(object $notifiable): string
    {
        return $this->type;
    }

    /**
     * Whether the customer has this type+channel enabled. Missing rows are
     * treated as enabled so existing users get ticket notifications by default.
     */
    protected function preferenceEnabled(object $notifiable, string $channel): bool
    {
        $preference = NotificationPreference::query()
            ->where('user_id', $notifiable->id)
            ->where('type', $this->type)
            ->where('channel', $channel)
            ->first();

        return $preference?->enabled ?? true;
    }
}
