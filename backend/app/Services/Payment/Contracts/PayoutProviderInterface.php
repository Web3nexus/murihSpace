<?php

namespace App\Services\Payment\Contracts;

use App\Services\Payment\DTO\PayoutRequest;
use App\Services\Payment\DTO\PayoutResponse;

interface PayoutProviderInterface extends PaymentProviderInterface
{
    /**
     * Initiate a payout to a bank account or mobile money recipient.
     */
    public function initiatePayout(PayoutRequest $request): PayoutResponse;

    /**
     * Verify the final settlement status of a payout.
     */
    public function verifyPayout(string $providerPayoutId): array;
}
