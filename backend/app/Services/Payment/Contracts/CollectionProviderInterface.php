<?php

namespace App\Services\Payment\Contracts;

use App\Services\Payment\DTO\PaymentIntentRequest;
use App\Services\Payment\DTO\PaymentIntentResponse;
use App\Services\Payment\DTO\PaymentVerificationResult;

interface CollectionProviderInterface extends PaymentProviderInterface
{
    /**
     * Create a payment intent or checkout session with the provider.
     */
    public function createPaymentIntent(PaymentIntentRequest $request): PaymentIntentResponse;

    /**
     * Server-side re-verification of a transaction using the provider's API.
     * Never trust client redirects.
     */
    public function verifyPayment(string $reference, array $context = []): PaymentVerificationResult;
}
