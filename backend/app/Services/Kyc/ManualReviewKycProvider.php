<?php

namespace App\Services\Kyc;

use App\Models\User;

class ManualReviewKycProvider implements KycProviderInterface
{
    public function name(): string
    {
        return 'manual';
    }

    public function isEnabled(): bool
    {
        return true;
    }

    public function createSession(User $user): KycSessionResult
    {
        return new KycSessionResult(
            success: false,
            message: 'Manual review is active — please upload a document for review.',
        );
    }

    public function fetchDecision(string $sessionId): KycDecisionResult
    {
        return new KycDecisionResult(success: false);
    }

    public function verifyWebhook(string $payload, array $headers): ?VerifiedKycWebhook
    {
        return null;
    }
}
