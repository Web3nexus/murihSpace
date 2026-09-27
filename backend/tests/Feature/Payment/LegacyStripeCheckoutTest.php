<?php

namespace Tests\Feature\Payment;

use App\Models\DigitalProduct;
use App\Models\Order;
use App\Models\PaymentProvider;
use App\Models\User;
use Illuminate\Support\Str;
use App\Services\Payment\StripePaymentProvider;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Stripe\Stripe;
use Tests\TestCase;

class LegacyStripeCheckoutTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config([
            'stripe.key' => 'pk_test_legacy',
            'stripe.secret' => 'sk_test_legacy',
            'stripe.webhook_secret' => 'whsec_legacy',
        ]);
    }

    public function test_env_secret_is_used_when_no_admin_record_exists(): void
    {
        new StripePaymentProvider;

        $this->assertSame('sk_test_legacy', Stripe::getApiKey());
    }

    public function test_admin_saved_secret_overrides_the_env_value(): void
    {
        // The admin UI reports Stripe as "Configured" from the saved
        // secret_key, so the provider has to actually use it. It used to read
        // config('stripe.secret') only, leaving the saved key inert.
        PaymentProvider::create([
            'code' => 'stripe',
            'name' => 'Stripe Payments',
            'is_enabled' => true,
            'environment' => 'sandbox',
            'config' => ['secret_key' => 'sk_test_from_admin'],
        ]);

        new StripePaymentProvider;

        $this->assertSame('sk_test_from_admin', Stripe::getApiKey());
    }

    public function test_admin_saved_webhook_secret_is_used_for_verification(): void
    {
        PaymentProvider::create([
            'code' => 'stripe',
            'name' => 'Stripe Payments',
            'is_enabled' => true,
            'environment' => 'sandbox',
            'config' => [
                'secret_key' => 'sk_test_from_admin',
                'webhook_secret' => 'whsec_from_admin',
            ],
        ]);

        $provider = new StripePaymentProvider;

        $payload = '{"id":"evt_1","type":"payment_intent.succeeded","data":{"object":{"id":"pi_1"}}}';
        $request = \Illuminate\Http\Request::create(
            '/api/v1/webhooks/stripe',
            'POST',
            [],
            [],
            [],
            ['HTTP_STRIPE_SIGNATURE' => $this->sign($payload, 'whsec_from_admin')],
            $payload,
        );

        $verified = $provider->verifyWebhook($request);

        $this->assertNotNull($verified, 'The admin-saved webhook secret must verify signatures.');
        $this->assertSame('evt_1', $verified['event_id']);
    }

    public function test_checkout_hands_the_provider_a_resolved_return_url(): void
    {
        config(['payments.return_url' => 'https://web.test/done?ref={reference}']);

        $user = $this->verifiedUser();
        $product = $this->product($user);

        $response = $this->actingAs($user)->postJson('/api/v1/checkout/intent', [
            'product_id' => $product->id,
            'payment_provider' => 'mock',
            'idempotency_key' => 'legacy-return-url-1',
        ]);

        $response->assertStatus(201);

        $redirect = $response->json('data.data.intent.redirect_url');
        $this->assertNotNull($redirect, 'Legacy checkout must not hand back a null return URL.');

        $order = Order::where('idempotency_key', 'legacy-return-url-1')->firstOrFail();
        $this->assertStringContainsString($order->order_number, $redirect);
    }

    public function test_client_supplied_return_url_wins_on_legacy_checkout(): void
    {
        config(['payments.return_url' => 'https://configured.test/done']);

        $user = $this->verifiedUser();
        $product = $this->product($user);

        $response = $this->actingAs($user)->postJson('/api/v1/checkout/intent', [
            'product_id' => $product->id,
            'payment_provider' => 'mock',
            'idempotency_key' => 'legacy-return-url-2',
            'return_url' => 'https://client.test/after-pay',
        ]);

        $response->assertStatus(201);
        $this->assertSame('https://client.test/after-pay', $response->json('data.data.intent.redirect_url'));
    }

    public function test_disabled_provider_is_rejected_on_the_checkout_path(): void
    {
        // resolveProvider() builds the provider directly rather than going
        // through ProviderRouter, so the admin toggle was not consulted here
        // and a client could still force a provider an admin had switched off.
        PaymentProvider::create([
            'code' => 'stripe',
            'name' => 'Stripe Payments',
            'is_enabled' => false,
            'environment' => 'sandbox',
        ]);

        $user = $this->verifiedUser();
        $product = $this->product($user);

        $this->actingAs($user)->postJson('/api/v1/checkout/intent', [
            'product_id' => $product->id,
            'payment_provider' => 'stripe',
            'idempotency_key' => 'legacy-disabled-1',
        ])->assertStatus(422);
    }

    public function test_unmanaged_provider_without_an_admin_record_is_allowed(): void
    {
        $user = $this->verifiedUser();
        $product = $this->product($user);

        $this->actingAs($user)->postJson('/api/v1/checkout/intent', [
            'product_id' => $product->id,
            'payment_provider' => 'mock',
            'idempotency_key' => 'legacy-unmanaged-1',
        ])->assertStatus(201);
    }

    public function test_disabled_provider_still_settles_an_in_flight_webhook(): void
    {
        // Regression guard: webhook ingestion resolves providers through the
        // same factory as checkout. When the enable/disable guard lived in that
        // factory, a provider an admin switched off after the customer had
        // already paid rejected the settlement webhook with 422, and the
        // provider's retries never got through. Disabling must stop new
        // checkouts only.
        PaymentProvider::create([
            'code' => 'mock',
            'name' => 'Mock',
            'is_enabled' => false,
            'environment' => 'sandbox',
        ]);

        $user = $this->verifiedUser();
        $product = $this->product($user);
        $order = Order::create([
            'order_number' => 'ORD-DISABLED-SETTLE',
            'buyer_id' => $user->id,
            'creator_id' => $user->id,
            'product_id' => $product->id,
            'subtotal' => 25.00,
            'platform_fee' => 2.50,
            'total' => 27.50,
            'currency' => 'USD',
            'status' => 'processing',
            'payment_provider' => 'mock',
            'payment_intent_id' => 'mock_settle_1',
            'idempotency_key' => 'legacy-settle-1',
        ]);

        $response = $this->postJson('/api/v1/checkout/webhooks/mock', [
            'event_id' => 'evt_disabled_settle',
            'event_type' => 'payment_intent.succeeded',
            'intent_id' => 'mock_settle_1',
        ]);

        $response->assertStatus(200);
        $this->assertSame(
            'completed',
            $order->fresh()->status,
            'A provider disabled after payment must still settle that order.'
        );
    }

    private function verifiedUser(): User
    {
        $user = User::factory()->create();
        $user->forceFill(['email_verified_at' => now()])->save();

        return $user->fresh();
    }

    private function product(User $creator): DigitalProduct
    {
        return DigitalProduct::create([
            'creator_id' => $creator->id,
            'title' => 'Test product',
            'slug' => 'test-product-'.Str::lower(Str::random(8)),
            'price' => 25,
            'currency' => 'USD',
            'status' => 'published',
        ]);
    }

    private function sign(string $payload, string $secret): string
    {
        $timestamp = time();
        $signature = hash_hmac('sha256', $timestamp.'.'.$payload, $secret);

        return "t={$timestamp},v1={$signature}";
    }
}
