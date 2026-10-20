<?php

namespace App\Services\Payment\Contracts;

use App\Enums\RefundStatus;

/**
 * A provider that can report a refund's final status on request. Used by refunds:reconcile-pending
 * as the backstop when a webhook was lost. No provider implements it yet, because no provider's
 * refund status endpoint has been verified against its documentation.
 */
interface RefundStatusProviderInterface extends PaymentProviderInterface
{
    /**
     * Final status of a refund at the provider, or null when it cannot be confirmed.
     */
    public function verifyRefund(string $providerRefundId): ?RefundStatus;
}
