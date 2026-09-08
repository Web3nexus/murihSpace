<?php

namespace App\Services\Payment\DTO;

class NormalizedWebhookEvent
{
    public function __construct(
        public readonly string $provider,
        public readonly string $eventId,
        public readonly string $eventType,
        public readonly string $resourceReference, // payment, payout, or refund reference
        public readonly string $status, // normalized internal status
        public readonly ?int $amount = null, // in minor units if provided
        public readonly ?string $currency = null,
        public readonly array $payload = [],
        public readonly ?string $timestamp = null,
    ) {}
}
