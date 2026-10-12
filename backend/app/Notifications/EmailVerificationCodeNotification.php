<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

/**
 * In-app copy of the email verification code so it is discoverable from the
 * notification feed (web + mobile) instead of only the inbox.
 *
 * Note: the ephemeral login/OTP delivery path (see PhoneOtpService) never
 * persists codes to the notifications table. Email verification is a
 * user-owned account action rather than an authentication challenge, so the
 * code is retained here for convenience and expires with the account's
 * verification window.
 */
class EmailVerificationCodeNotification extends Notification
{
    use Queueable;

    public function __construct(
        public readonly string $code,
        public readonly int $ttlMinutes = 15,
    ) {}

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['database'];
    }

    /**
     * @return array<string, mixed>
     */
    public function toDatabase(object $notifiable): array
    {
        return [
            'type' => 'email_verification_code',
            'is_official' => true,
            'sender_name' => 'Murih Notifications Official',
            'is_verified' => true,
            'title' => 'Email verification code sent',
            'body' => "We sent a 6-digit verification code to your email. It expires in {$this->ttlMinutes} minutes.",
            'message' => "We sent a 6-digit verification code to your email. It expires in {$this->ttlMinutes} minutes.",
            'action_label' => 'Check Email',
            'action_url' => null,
            'metadata' => [
                'expires_in_minutes' => $this->ttlMinutes,
            ],
            'created_at' => now()->toIso8601String(),
        ];
    }

    public function databaseType(object $notifiable): string
    {
        return 'email_verification_code';
    }
}
