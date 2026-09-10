<?php

namespace App\Services\Payment\DTO;

class RefundRequest
{
    public function __construct(
        public readonly string $internalReference,
        public readonly string $paymentReference,
        public readonly string $providerPaymentId,
        public readonly int $amount, // Minor units
        public readonly string $currency,
        public readonly string $reason,
        public readonly string $idempotencyKey,
    ) {}
}

