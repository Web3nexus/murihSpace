<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use NotificationChannels\Telegram\TelegramMessage;
use App\Models\AdminSetting;

class AdminAlertNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public string $title,
        public string $message,
        public ?string $actionUrl = null
    ) {}

    /**
     * Get the notification's delivery channels.
     *
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        $channels = [];
        
        // We assume $notifiable provides routeNotificationForMail and routeNotificationForTelegram
        if ($notifiable->routeNotificationFor('mail')) {
            $channels[] = 'mail';
        }
        
        if ($notifiable->routeNotificationFor('telegram')) {
            $channels[] = 'telegram';
        }

        return $channels;
    }

    /**
     * Get the mail representation of the notification.
     */
    public function toMail(object $notifiable): MailMessage
    {
        $mail = (new MailMessage)
                    ->subject('Admin Alert: ' . $this->title)
                    ->line($this->message);

        if ($this->actionUrl) {
            $mail->action('View Details', $this->actionUrl);
        }

        return $mail;
    }

    /**
     * Get the telegram representation of the notification.
     */
    public function toTelegram($notifiable)
    {
        $token = AdminSetting::get('admin_notify_telegram_bot_token');
        
        $telegram = TelegramMessage::create()
            ->token($token)
            ->to($notifiable->routeNotificationFor('telegram'))
            ->content("*" . $this->title . "*\n\n" . $this->message);

        if ($this->actionUrl) {
            $telegram->button('View Details', $this->actionUrl);
        }

        return $telegram;
    }
}
