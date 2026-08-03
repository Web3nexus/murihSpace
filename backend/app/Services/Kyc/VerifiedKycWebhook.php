<?php

namespace App\Services\Kyc;

/**
 * Normalised view of a KYC webhook that the platform can act on.
 */
final readonly class VerifiedKycWebhook
{
    public function __construct(
        public string $eventId,
        public string $sessionId,
        public string $status,
        public string $webhookType,
        public array $payload,
    ) {}

    public function isDecision(): bool
    {
        return in_array($this->webhookType, [
            'session.decision',
            'verification.decision',
            'check.completed',
            'decision',
            'applicantReviewed',
        ], true);
    }

    public function isApproved(): bool
    {
        return in_array(strtolower($this->status), ['approved', 'verified', 'passed', 'success', 'completed'], true);
    }

    public function isRejected(): bool
    {
        return in_array(strtolower($this->status), ['rejected', 'denied', 'failed', 'declined', 'expired'], true);
    }
}
