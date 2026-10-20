<?php

namespace App\Notifications;

use Illuminate\Notifications\Notification;

/**
 * Tells a seller their earnings are held until they verify their identity. Carries a
 * link that starts the verification: the provider session when one could be created,
 * otherwise the in-app KYC page. Stored on the database channel only.
 */
class KycEarningsNotification extends Notification
{
    public const KIND = 'kyc_required_for_earnings';

    public function __construct(private readonly ?string $sessionUrl = null) {}

    /** @return array<int, string> */
    public function via(object $notifiable): array
    {
        return ['database'];
    }

    /** @return array<string, mixed> */
    public function toArray(object $notifiable): array
    {
        return [
            'type' => 'kyc_required',
            'kind' => self::KIND,
            'message' => 'Your earnings are safe, but they can only be withdrawn after you verify your identity. Verify now to release them.',
            'action' => 'verify_identity',
            // The provider session is single-use and expires, so the in-app page is always included.
            'session_url' => $this->sessionUrl,
            'web_path' => '/app/kyc',
            'app_path' => '/kyc',
        ];
    }
}
