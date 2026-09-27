<?php

namespace App\Services\Payment;

use App\Models\Order;
use App\Services\Payment\Support\ProviderConfigResolver;
use Illuminate\Http\Request;
use Stripe\PaymentIntent;
use Stripe\Stripe;
use Stripe\Webhook;

class StripePaymentProvider implements PaymentProviderInterface
{
    /**
     * Resolved config: config/stripe.php env values overlaid with any keys
     * saved through the admin UI.
     *
     * This provider is on the legacy order/checkout path rather than the
     * PaymentRouter, but the admin UI still offers it and reports it as
     * "Configured" from the saved `secret_key`. Reading config('stripe.*')
     * alone meant those saved keys were never used and checkout failed against
     * Stripe anyway.
     *
     * @var array<string, mixed>
     */
    private array $resolvedConfig;

    public function __construct()
    {
        $this->resolvedConfig = array_merge(
            (array) config('stripe', []),
            ProviderConfigResolver::resolve('stripe'),
        );

        Stripe::setApiKey($this->resolvedConfig['secret'] ?? '');
    }

    public function providerName(): string
    {
        return 'stripe';
    }

    public function createCheckoutIntent(Order $order, ?string $returnUrl = null): array
    {
        $params = [
            'amount' => (int) round($order->total * 100),
            'currency' => strtolower($order->currency),
            'metadata' => [
                'order_id' => $order->id,
                'order_number' => $order->order_number,
            ],
            'automatic_payment_methods' => [
                'enabled' => true,
            ],
        ];

        // Only sent when configured: Stripe rejects an empty return_url, and the
        // customer must land back in the app once the payment settles.
        if (! empty($returnUrl)) {
            $params['return_url'] = $returnUrl;
        }

        $intent = PaymentIntent::create($params);

        return [
            'provider' => 'stripe',
            'intent_id' => $intent->id,
            'client_secret' => $intent->client_secret,
            'redirect_url' => $returnUrl,
        ];
    }

    public function verifyWebhook(Request $request): ?array
    {
        $webhookSecret = $this->resolvedConfig['webhook_secret'] ?? null;
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
