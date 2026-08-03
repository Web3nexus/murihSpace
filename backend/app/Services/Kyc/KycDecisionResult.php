<?php

namespace App\Services\Kyc;

/**
 * Result of querying a provider for a session's final decision.
 */
final readonly class KycDecisionResult
{
    public function __construct(
        public bool $success,
        public ?string $status = null,
        public ?string $reason = null,
        public ?string $code = null,
        public array $metadata = [],
    ) {}
}
