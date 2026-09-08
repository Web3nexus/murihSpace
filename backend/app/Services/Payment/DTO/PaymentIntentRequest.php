<?php

namespace App\Services\Payment\DTO;

class PaymentIntentRequest
{
    public function __construct(
        public readonly string $internalReference,
        public readonly string $publicReference,
        public readonly int $amount, // Minor units (kobo, cents)
        public readonly string $currency,
        public readonly string $paymentMethod,
        public readonly string $customerEmail,
        public readonly ?string $customerName = null,
        public readonly ?string $returnUrl = null,
        public readonly array $metadata = [],
        public readonly ?string $idempotencyKey = null,
    ) {}
}
