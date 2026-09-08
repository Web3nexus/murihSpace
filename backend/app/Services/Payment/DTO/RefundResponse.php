<?php

namespace App\Services\Payment\DTO;

use App\Enums\RefundStatus;

class RefundResponse
{
    public function __construct(
        public readonly string $provider,
        public readonly string $providerRefundId,
        public readonly RefundStatus $status,
        public readonly ?string $failureReason = null,
        public readonly array $rawResponse = [],
    ) {}
}
