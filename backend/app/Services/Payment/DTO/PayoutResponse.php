<?php

namespace App\Services\Payment\DTO;

use App\Enums\PayoutStatus;

class PayoutResponse
{
    public function __construct(
        public readonly string $provider,
        public readonly string $providerPayoutId,
        public readonly string $providerReference,
        public readonly PayoutStatus $status,
        public readonly int $feeAmount = 0,
        public readonly ?string $failureReason = null,
        public readonly array $rawResponse = [],
    ) {}
}
