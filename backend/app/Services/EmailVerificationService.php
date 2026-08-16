<?php

namespace App\Services;

use App\Models\User;

class EmailVerificationService
{
    public const CODE_TTL_MINUTES = 15;

    public function __construct(
        private readonly NotificationService $notifications,
    ) {}

    /**
     * Generate a one-time code, store it hashed, and email it to the user.
     */
    public function issue(User $user): void
    {
        if (! $user->email || $user->hasVerifiedEmail()) {
            return;
        }

        $code = (string) random_int(100000, 999999);

        $user->update([
            'email_verify_code_hash' => hash('sha256', $code),
            'email_verify_code_expires_at' => now()->addMinutes(self::CODE_TTL_MINUTES),
        ]);

        $this->notifications->actionEmail(
            user: $user,
            title: 'Your MurihSpace verification code',
            bodyHtml: '<p>Hi '.e($user->name).',</p><p>Your email verification code is:</p><p style="font-size:30px; letter-spacing:8px; font-weight:800; color:#0F172A;">'.$code.'</p><p>Enter this code to verify your email and unlock Mera. The code expires in '.self::CODE_TTL_MINUTES.' minutes.</p>',
            template: 'email_verification',
            data: ['code' => $code],
        );
    }

    public function resend(User $user): void
    {
        $this->issue($user);
    }

    /**
     * @return array{ok: bool, message: string}
     */
    public function verify(User $user, string $code): array
    {
        if ($user->hasVerifiedEmail()) {
            return ['ok' => true, 'message' => 'Email address already verified.'];
        }

        if ($user->email_verify_code_hash === null
            || $user->email_verify_code_expires_at === null
            || $user->email_verify_code_expires_at->isPast()) {
            return ['ok' => false, 'message' => 'Verification code expired. Request a new one.'];
        }

        if (! hash_equals((string) $user->email_verify_code_hash, hash('sha256', trim($code)))) {
            return ['ok' => false, 'message' => 'Invalid verification code.'];
        }

        $user->forceFill([
            'email_verified_at' => now(),
            'email_verify_code_hash' => null,
            'email_verify_code_expires_at' => null,
        ])->save();

        return ['ok' => true, 'message' => 'Email address verified successfully.'];
    }
}
