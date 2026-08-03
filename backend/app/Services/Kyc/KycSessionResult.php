<?php

namespace App\Services\Kyc;

/**
 * Result of creating/starting a verification session with a provider.
 */
final readonly class KycSessionResult
{
    public function __construct(
        public bool $success,
        public ?string $sessionUrl = null,
        public ?string $sessionId = null,
        public ?string $clientToken = null,
        public ?string $message = null,
    ) {}
}
