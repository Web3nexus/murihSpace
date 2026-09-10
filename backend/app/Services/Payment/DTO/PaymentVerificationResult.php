<?php

namespace App\Services\Payment\DTO;

use App\Enums\PaymentStatus;

class PaymentVerificationResult
{
    public function __construct(
        public readonly bool $isSuccessful,
        public readonly PaymentStatus $status,
        public readonly string $providerReference,
        public readonly ?string $providerTransactionId = null,
        public readonly ?int $amount = null, // Minor units
        public readonly ?string $currency = null,
        public readonly ?string $failureReason = null,
        public readonly array $rawResponse = [],
    ) {}

    public function isPending(): bool
    {
        return $this->status === PaymentStatus::Pending || $this->status === PaymentStatus::Processing;
    }
}
