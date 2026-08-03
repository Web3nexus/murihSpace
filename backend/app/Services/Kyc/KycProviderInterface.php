<?php

namespace App\Services\Kyc;

use App\Models\User;

interface KycProviderInterface
{
    /**
     * Provider key, e.g. "didit" | "manual" | "sumsub".
     */
    public function name(): string;

    /**
     * Whether the provider is fully configured and can be used.
     */
    public function isEnabled(): bool;

    /**
     * Create (or resume) a verification session for a user.
     */
    public function createSession(User $user): KycSessionResult;

    /**
     * Fetch the current/latest decision for a session.
     */
    public function fetchDecision(string $sessionId): KycDecisionResult;

    /**
     * Verify an inbound webhook. Returns the normalised event or null when invalid/ignorable.
     */
    public function verifyWebhook(string $payload, array $headers): ?VerifiedKycWebhook;
}
