<?php

namespace App\Services\Payment;

use App\Models\Order;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

/**
 * Mock payment provider for development and testing.
 * Simulates an immediate successful payment intent without
 * contacting any external service.
 */
class MockPaymentProvider implements PaymentProviderInterface
{
    public function providerName(): string
    {
        return 'mock';
    }

    public function createCheckoutIntent(Order $order): array
    {
        $intentId = 'mock_'.Str::upper(Str::random(16));

        return [
            'provider' => 'mock',
            'intent_id' => $intentId,
            'client_secret' => null,
            'redirect_url' => null,
        ];
    }

    /**
     * The mock provider sends our own webhook format.
     * Signature verification is skipped in test mode.
     */
    public function verifyWebhook(Request $request): ?array
    {
        $payload = $request->json()->all();

        if (empty($payload['event_id'] ?? null)) {
            return null;
        }

        return [
            'event_id' => $payload['event_id'],
            'event_type' => $payload['event_type'] ?? 'payment.completed',
            'intent_id' => $payload['intent_id'] ?? null,
            'status' => $payload['status'] ?? 'completed',
        ];
    }
}
