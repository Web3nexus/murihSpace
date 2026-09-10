<?php

namespace App\Services\Payment\DTO;

class PayoutRequest
{
    public function __construct(
        public readonly string $internalReference,
        public readonly string $publicReference,
        public readonly int $amount, // Minor units
        public readonly string $currency,
        public readonly string $destinationType, // bank_account, mobile_money
        public readonly array $destinationDetails,
        public readonly string $idempotencyKey,
        public readonly string $narration = 'MurihSpace Creator Payout',
    ) {}
}
