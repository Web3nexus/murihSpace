<?php

namespace App\Services\Payment;

use App\Models\Order;
use Illuminate\Http\Request;
use Stripe\Stripe;
use Stripe\PaymentIntent;
use Stripe\Webhook;

class StripePaymentProvider implements PaymentProviderInterface
{
    public function __construct()
    {
        Stripe::setApiKey(config('stripe.secret'));
    }

    public function providerName(): string
    {
        return 'stripe';
    }

    public function createCheckoutIntent(Order $order): array
    {
        $intent = PaymentIntent::create([
            'amount' => (int) round($order->total * 100),
            'currency' => strtolower($order->currency),
            'metadata' => [
                'order_id' => $order->id,
                'order_number' => $order->order_number,
            ],
            'automatic_payment_methods' => [
                'enabled' => true,
            ],
        ]);

        return [
            'provider' => 'stripe',
            'intent_id' => $intent->id,
            'client_secret' => $intent->client_secret,
            'redirect_url' => null,
        ];
    }

    public function verifyWebhook(Request $request): ?array
    {
        $webhookSecret = config('stripe.webhook_secret');
        if (empty($webhookSecret)) {
            return null;
        }

        $payload = $request->getContent();
        $sigHeader = $request->header('Stripe-Signature');

        try {
            $event = Webhook::constructEvent($payload, $sigHeader, $webhookSecret);
        } catch (\Exception) {
            return null;
        }

        $intentId = null;
        $intent = $event->data->object ?? null;
        if ($intent && isset($intent->id)) {
            $intentId = $intent->id;
        }

        return [
            'event_id' => $event->id,
            'event_type' => $event->type,
            'intent_id' => $intentId,
            'status' => $event->type === 'payment_intent.succeeded' ? 'completed' : 'failed',
        ];
    }
}
