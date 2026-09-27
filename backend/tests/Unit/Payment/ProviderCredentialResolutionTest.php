<?php

namespace Tests\Unit\Payment;

use App\Models\PaymentProvider;
use App\Services\Payment\PaymentService;
use App\Services\Payment\Providers\FlutterwaveProvider;
use App\Services\Payment\Providers\PaddleProvider;
use App\Services\Payment\Providers\PaystackProvider;
use App\Services\Payment\Support\ProviderConfigResolver;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Admin-entered credentials must actually reach the provider classes, and a
 * payment intent must never be handed a null return/callback URL.
 */
class ProviderCredentialResolutionTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        PaymentProvider::query()->delete();
    }

    public function test_env_credentials_are_used_when_no_admin_row_exists(): void
    {
        config([
            'payments.providers.flutterwave.enabled' => true,
            'payments.providers.flutterwave.secret_key' => 'env-secret',
        ]);

        $provider = new FlutterwaveProvider();
        $this->assertTrue($provider->isAvailable());
    }

    public function test_admin_entered_secret_key_is_actually_used(): void
    {
        // The regression: keys saved via the admin UI were persisted and shown
        // as "Configured" but the provider only ever read env, so checkout
        // still threw "secret key is missing".
        config([
            'payments.providers.flutterwave.enabled' => false,
            'payments.providers.flutterwave.secret_key' => null,
        ]);

        PaymentProvider::create([
            'code' => 'flutterwave',
            'name' => 'Flutterwave',
            'is_enabled' => true,
            'environment' => 'sandbox',
            'priority' => 10,
            'health_status' => \App\Enums\ProviderHealthStatus::Healthy,
            'config' => [
                'public_key' => 'FLWPUBK_TEST-admin',
                'secret_key' => 'FLWSECK_TEST-admin',
            ],
        ]);

        $provider = new FlutterwaveProvider();

        $this->assertTrue($provider->isAvailable(), 'Admin-entered secret key must enable the provider.');
    }

    public function test_admin_toggle_controls_availability(): void
    {
        config([
            'payments.providers.paystack.enabled' => true,
            'payments.providers.paystack.secret_key' => 'env-secret',
        ]);

        PaymentProvider::create([
            'code' => 'paystack',
            'name' => 'Paystack',
            'is_enabled' => false,
            'environment' => 'live',
            'priority' => 10,
            'health_status' => \App\Enums\ProviderHealthStatus::Healthy,
            'config' => ['secret_key' => 'sk_live_admin'],
        ]);

        $provider = new PaystackProvider();
        $this->assertFalse($provider->isAvailable(), 'Admin "disable" must switch the provider off.');
    }

    public function test_flutterwave_admin_webhook_secret_maps_to_the_config_key(): void
    {
        // The admin form persists a generic `webhook_secret` field, but the
        // provider reads `webhook_secret_hash`.
        config([
            'payments.providers.flutterwave.enabled' => true,
            'payments.providers.flutterwave.webhook_secret_hash' => null,
        ]);

        PaymentProvider::create([
            'code' => 'flutterwave',
            'name' => 'Flutterwave',
            'is_enabled' => true,
            'environment' => 'sandbox',
            'priority' => 10,
            'health_status' => \App\Enums\ProviderHealthStatus::Healthy,
            'config' => [
                'secret_key' => 'FLWSECK_TEST-admin',
                'webhook_secret' => 'admin_secret_hash',
            ],
        ]);

        $request = \Illuminate\Http\Request::create('/api/v1/webhooks/flutterwave', 'POST');
        $request->headers->set('verif-hash', 'admin_secret_hash');

        $provider = new FlutterwaveProvider();
        $this->assertTrue($provider->verifyWebhookSignature($request));
    }

    public function test_blank_admin_field_does_not_wipe_a_working_env_value(): void
    {
        config([
            'payments.providers.paddle.enabled' => true,
            'payments.providers.paddle.api_key' => 'pdl_env_key',
        ]);

        PaymentProvider::create([
            'code' => 'paddle',
            'name' => 'Paddle',
            'is_enabled' => true,
            'environment' => 'sandbox',
            'priority' => 10,
            'health_status' => \App\Enums\ProviderHealthStatus::Healthy,
            'config' => [
                'api_key' => '',
                'webhook_secret' => '',
            ],
        ]);

        $cfg = ProviderConfigResolver::resolve('paddle');
        $this->assertSame('pdl_env_key', $cfg['api_key']);
    }

    public function test_resolve_falls_back_to_env_when_table_is_unavailable(): void
    {
        config(['payments.providers.flutterwave.secret_key' => 'env-secret']);

        // No admin row at all.
        $cfg = ProviderConfigResolver::resolve('flutterwave');
        $this->assertSame('env-secret', $cfg['secret_key']);
    }

    public function test_return_url_falls_back_to_config_when_client_omits_it(): void
    {
        config([
            'payments.return_url' => 'https://web.test/wallet?ref={reference}',
            'payments.return_url_fallback' => 'https://fallback.test/wallet',
        ]);

        $service = new PaymentService(
            $this->createMock(\App\Services\Payment\Router\ProviderRouter::class),
            $this->createMock(\App\Services\Wallet\LedgerService::class),
        );

        $method = new \ReflectionMethod(PaymentService::class, 'resolveReturnUrl');
        $method->setAccessible(true);

        $this->assertSame(
            'https://web.test/wallet?ref=PAY-123',
            $method->invoke($service, null, 'PAY-123'),
        );
    }

    public function test_client_supplied_return_url_wins(): void
    {
        config([
            'payments.return_url' => 'https://configured.test/wallet',
            'payments.return_url_fallback' => 'https://fallback.test/wallet',
        ]);

        $service = new PaymentService(
            $this->createMock(\App\Services\Payment\Router\ProviderRouter::class),
            $this->createMock(\App\Services\Wallet\LedgerService::class),
        );

        $method = new \ReflectionMethod(PaymentService::class, 'resolveReturnUrl');
        $method->setAccessible(true);

        $this->assertSame(
            'https://client.test/done',
            $method->invoke($service, 'https://client.test/done', 'PAY-123'),
        );
    }

    public function test_return_url_never_resolves_to_null(): void
    {
        // The bug: every provider received redirect_url/callback_url = null, so
        // a customer who paid was stranded on a provider-hosted page.
        config([
            'payments.return_url' => null,
            'payments.return_url_fallback' => 'https://fallback.test/wallet',
        ]);

        $service = new PaymentService(
            $this->createMock(\App\Services\Payment\Router\ProviderRouter::class),
            $this->createMock(\App\Services\Wallet\LedgerService::class),
        );

        $method = new \ReflectionMethod(PaymentService::class, 'resolveReturnUrl');
        $method->setAccessible(true);

        $this->assertSame('https://fallback.test/wallet', $method->invoke($service, null, 'PAY-1'));
    }

    /**
     * Wiring test: the helper above is only useful if initializePayment actually
     * calls it. Assert on the request object the provider receives.
     */
    public function test_initialize_payment_hands_the_provider_a_resolved_return_url(): void
    {
        config([
            'payments.return_url' => 'https://web.test/wallet?ref={reference}',
            'payments.return_url_fallback' => 'https://fallback.test/wallet',
        ]);

        $captured = null;

        $provider = \Mockery::mock(\App\Services\Payment\Contracts\CollectionProviderInterface::class);
        $provider->shouldReceive('providerCode')->andReturn('flutterwave');
        $provider->shouldReceive('createPaymentIntent')
            ->andReturnUsing(function ($req) use (&$captured) {
                $captured = $req;

                return new \App\Services\Payment\DTO\PaymentIntentResponse(
                    provider: 'flutterwave',
                    providerReference: $req->publicReference,
                    providerTransactionId: null,
                    redirectUrl: 'https://checkout.flutterwave.com/v3/hosted/pay/x',
                    clientSecret: null,
                    metadata: [],
                    rawResponse: [],
                );
            });

        $router = \Mockery::mock(\App\Services\Payment\Router\ProviderRouter::class);
        $router->shouldReceive('resolve')->andReturn($provider);

        $service = new PaymentService($router, $this->createMock(\App\Services\Wallet\LedgerService::class));

        $service->initializePayment([
            'amount' => 500000,
            'currency' => 'NGN',
            'customer_email' => 'buyer@example.com',
            'transaction_type' => 'wallet_topup',
            'idempotency_key' => 'wire-test-'.uniqid(),
        ]);

        $this->assertNotNull($captured, 'Provider must receive an intent request.');
        $this->assertNotNull($captured->returnUrl, 'Provider must never receive a null return_url.');
        $this->assertStringStartsWith(
            'https://web.test/wallet?ref=',
            $captured->returnUrl,
            'Configured return URL must be used and {reference} interpolated.'
        );
    }
}
