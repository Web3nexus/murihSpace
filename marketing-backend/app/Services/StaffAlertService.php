<?php

namespace App\Services;

use App\Models\StaffUser;
use App\Models\SupportSetting;
use App\Notifications\StaffEscalationMail;
use App\Notifications\StaffTicketNotification;
use Illuminate\Support\Facades\Notification;

/**
 * Routes staff ticket notifications, mirroring the main backend's
 * critical/normal admin-alert routing:
 *
 *   - normal   → in-app (SecureCRM bell) only
 *   - critical → in-app + email + Telegram (when configured)
 *
 * In-app notifications go to every active staff member who can view tickets,
 * or only to the specific staff ids passed when an alert targets an agent.
 */
class StaffAlertService
{
    public function notify(array $data): void
    {
        $severity = $data['severity'] ?? 'normal';
        $staffIds = $data['staff_ids'] ?? null;

        $recipients = $staffIds !== null
            ? StaffUser::query()->whereKey($staffIds)->where('is_active', true)->get()
            : StaffUser::query()->where('is_active', true)->get()
                ->filter(fn (StaffUser $staff) => $staff->hasPermission('ticket.view'))
                ->values();

        foreach ($recipients as $staff) {
            $staff->notify(new StaffTicketNotification(
                $data['type'] ?? 'ticket',
                $data['title'],
                $data['message'],
                $data['action_url'] ?? null,
                $data['ticket_number'] ?? null,
            ));
        }

        if ($severity === 'critical') {
            $this->sendEscalations($data);
        }
    }

    protected function sendEscalations(array $data): void
    {
        $email = SupportSetting::get('staff_notify_email');
        $chatId = SupportSetting::get('staff_notify_telegram_chat_id');
        $token = SupportSetting::get('staff_notify_telegram_bot_token');

        $title = $data['title'];
        $message = $data['message'];
        $actionUrl = $data['action_url'] ?? null;

        if ($email) {
            Notification::route('mail', $email)->notify(new StaffEscalationMail($title, $message, $actionUrl));
        }

        if ($chatId && $token) {
            app(TelegramNotifier::class)->send($token, $chatId, $title, $message, $actionUrl);
        }
    }
}
