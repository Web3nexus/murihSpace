<?php

namespace App\Services\Payment;

use App\Models\Order;
use Illuminate\Http\Request;

interface PaymentProviderInterface
{
    /**
     * Create a checkout session / payment intent with the provider.
     * Returns provider-specific data including a redirect URL or client secret.
     *
     * @return array{provider: string, intent_id: string, client_secret: string|null, redirect_url: string|null}
     */
    public function createCheckoutIntent(Order $order): array;

    /**
     * Verify and parse an inbound webhook from the provider.
     * Must throw an exception or return null on invalid signature.
     *
     * @return array{event_id: string, event_type: string, intent_id: string|null, status: string}|null
     */
    public function verifyWebhook(Request $request): ?array;

    /**
     * The provider identifier string (e.g. 'stripe', 'mock').
     */
    public function providerName(): string;
}
