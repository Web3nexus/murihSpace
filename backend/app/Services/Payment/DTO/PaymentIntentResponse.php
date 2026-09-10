<?php

namespace App\Services\Payment\DTO;

class PaymentIntentResponse
{
    public function __construct(
        public readonly string $provider,
        public readonly string $providerReference,
        public readonly ?string $providerTransactionId = null,
        public readonly ?string $redirectUrl = null,
        public readonly ?string $clientSecret = null,
        public readonly array $metadata = [],
        public readonly array $rawResponse = [],
    ) {}
}

