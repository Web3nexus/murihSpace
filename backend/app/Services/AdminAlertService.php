<?php

namespace App\Services;

use App\Models\AdminAlert;
use App\Models\AdminSetting;
use App\Models\User;
use App\Notifications\AdminAlertNotification;
use Illuminate\Support\Arr;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Notification;

class AdminAlertService
{
    public function dispatch(array $data): AdminAlert
    {
        $alert = AdminAlert::create([
            'event_type' => $data['event_type'] ?? 'unknown',
            'severity' => $data['severity'] ?? 'warning',
            'environment' => $data['environment'] ?? 'production',
            'title' => $data['title'] ?? 'Admin alert',
            'description' => $this->sanitizeDescription($data['description'] ?? ''),
            'affected_service' => $data['affected_service'] ?? null,
            'reference' => $data['reference'] ?? null,
            'metadata' => $data['metadata'] ?? [],
            'channels' => $this->channelsFor($data['severity'] ?? 'warning'),
            'requires_acknowledgement' => $this->requiresAcknowledgement($data['severity'] ?? 'warning'),
            'status' => 'new',
        ]);

        $this->sendNotifications($alert);

        // Section 17 & 18: Record into dedicated admin_notifications table
        try {
            $category = $this->mapEventTypeToCategory($alert->event_type);
            app(AdminNotificationService::class)->dispatch([
                'category' => $category,
                'severity' => $alert->severity,
                'title' => $alert->title,
                'message' => $alert->description ?? $alert->title,
                'action_url' => $alert->reference,
                'reference_id' => $alert->reference,
                'reference_type' => $alert->event_type,
                'metadata' => $alert->metadata,
            ]);
        } catch (\Throwable $e) {
            \Log::warning('AdminNotification dispatch failed from AdminAlertService: ' . $e->getMessage());
        }

        return $alert;
    }

    protected function mapEventTypeToCategory(string $eventType): string
    {
        return match ($eventType) {
            'user_registered', 'new_user', 'registration' => \App\Enums\AdminNotificationCategory::NewUserRegistration->value,
            'kyc_submission', 'kyc_request', 'kyc_pending' => \App\Enums\AdminNotificationCategory::KycRequest->value,
            'role_application', 'account_upgrade', 'creator_application', 'vendor_application' => \App\Enums\AdminNotificationCategory::AccountUpgradeRequest->value,
            'deposit_initiated', 'deposit_request', 'deposit_pending' => \App\Enums\AdminNotificationCategory::DepositRequest->value,
            'withdrawal_request', 'payout_requested', 'payout_pending' => \App\Enums\AdminNotificationCategory::WithdrawalRequest->value,
            'payment_failed', 'payment_issue', 'chargeback', 'gateway_error' => \App\Enums\AdminNotificationCategory::PaymentIssues->value,
            'security_alert', 'brute_force', 'unauthorized_access', 'mfa_failure' => \App\Enums\AdminNotificationCategory::SecurityAlerts->value,
            'support_message', 'support_ticket', 'ticket_created', 'ticket_escalated' => \App\Enums\AdminNotificationCategory::SupportRequests->value,
            'moderation_flag', 'content_flag', 'report_created', 'moderation_event' => \App\Enums\AdminNotificationCategory::ModerationEvents->value,
            'infrastructure_alert', 'queue_backlog', 'worker_restart', 'disk_space' => \App\Enums\AdminNotificationCategory::InfrastructureNotifications->value,
            default => \App\Enums\AdminNotificationCategory::SystemAlerts->value,
        };
    }

    protected function sendNotifications(AdminAlert $alert): void
    {
        $email = AdminSetting::get('admin_notify_email');
        $chatId = AdminSetting::get('admin_notify_telegram_chat_id');

        $route = Notification::route('mail', $email ?? '');
        $hasChannel = false;

        if ($email && in_array('email', $alert->channels)) {
            $hasChannel = true;
        }

        if ($chatId && in_array('telegram', $alert->channels)) {
            $route->route('telegram', $chatId);
            $hasChannel = true;
        }

        if ($hasChannel) {
            $route->notify(new AdminAlertNotification(
                $alert->title,
                $alert->description,
                $alert->reference
            ));
        }
    }

    public function acknowledge(AdminAlert $alert, User $actor, ?string $note = null): AdminAlert
    {
        $alert->update([
            'status' => 'acknowledged',
            'acknowledged_at' => now(),
            'acknowledged_by' => $actor->id,
            'acknowledgement_note' => $note,
        ]);

        return $alert->fresh();
    }

    protected function channelsFor(string $severity): array
    {
        return match ($severity) {
            'critical' => ['email', 'telegram'],
            'warning' => ['email', 'telegram'],
            default => ['email'],
        };
    }

    protected function requiresAcknowledgement(string $severity): bool
    {
        return $severity === 'critical';
    }

    protected function sanitizeDescription(string $description): string
    {
        $redacted = $description;
        foreach (['card_number', 'card', 'token', 'otp_code', 'password', 'secret'] as $key) {
            $redacted = preg_replace('/' . preg_quote($key, '/') . '\s*[:=]?\s*[^\s,;]+/i', '[redacted]', $redacted) ?? $redacted;
        }

        $redacted = preg_replace('/\b\d{4}(?:[- ]?\d{4}){3}\b/', '[redacted]', $redacted) ?? $redacted;
        $redacted = preg_replace('/\b[a-zA-Z0-9]{8,}\b/', '[redacted]', $redacted) ?? $redacted;
        $redacted = preg_replace('/\b\d{6}\b/', '[redacted]', $redacted) ?? $redacted;

        return trim($redacted);
    }
}
