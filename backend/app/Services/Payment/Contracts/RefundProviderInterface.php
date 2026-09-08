<?php

namespace App\Services\Payment\Contracts;

use App\Services\Payment\DTO\RefundRequest;
use App\Services\Payment\DTO\RefundResponse;

interface RefundProviderInterface extends PaymentProviderInterface
{
    /**
     * Issue a refund for a previously captured payment.
     */
    public function processRefund(RefundRequest $request): RefundResponse;
}
