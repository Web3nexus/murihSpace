<?php

namespace App\Services\Payment\Contracts;

use App\Services\Payment\DTO\NormalizedWebhookEvent;
use Illuminate\Http\Request;

interface ProviderWebhookInterface extends PaymentProviderInterface
{
    /**
     * Validates the cryptographic webhook signature specific to this provider.
     */
    public function verifyWebhookSignature(Request $request): bool;

    /**
     * Parses the inbound HTTP request into a normalized event structure.
     */
    public function parseWebhookEvent(Request $request): NormalizedWebhookEvent;
}
