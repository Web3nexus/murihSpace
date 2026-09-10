<?php

namespace Tests\Unit\Payment;

use App\Services\Payment\DTO\PaymentIntentRequest;
use App\Services\Payment\Providers\AirwallexProvider;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class AirwallexProviderTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        config([
            'payments.providers.airwallex.enabled' => true,
            'payments.providers.airwallex.client_id' => 'test_client_id',
            'payments.providers.airwallex.api_key' => 'test_api_key',
            'payments.providers.airwallex.webhook_secret' => 'test_wh_secret_xyz',
            'payments.providers.airwallex.base_url' => 'https://api-demo.airwallex.com/api/v1',
        ]);
    }

    public function test_authenticates_and_creates_payment_intent(): void
    {
        Http::fake([
            'https://api-demo.airwallex.com/api/v1/authentication/login' => Http::response([
                'token' => 'mock_awx_bearer_token',
                'expires_at' => now()->addMinutes(30)->toISOString(),
            ], 200),
            'https://api-demo.airwallex.com/api/v1/pa/payment_intents/create' => Http::response([
                'id' => 'int_test_123456',
                'client_secret' => 'cs_test_secret_789',
                'status' => 'REQUIRES_PAYMENT_METHOD',
                'next_action' => [
                    'url' => 'https://checkout.airwallex.com/hosted-flow/int_test_123456',
                ],
            ], 200),
        ]);

        $provider = new AirwallexProvider();
        $this->assertTrue($provider->isAvailable());

        $req = new PaymentIntentRequest(
            internalReference: 'uuid-1111-2222',
            publicReference: 'PAY-20260908-ABCDEFGH',
            amount: 5000, // 50.00 USD in cents
            currency: 'USD',
            paymentMethod: 'card',
            customerEmail: 'buyer@example.com',
            customerName: 'Jane Doe',
            returnUrl: 'https://murihspace.com/checkout/return'
        );

        $res = $provider->createPaymentIntent($req);

        $this->assertEquals('airwallex', $res->provider);
        $this->assertEquals('int_test_123456', $res->providerReference);
        $this->assertEquals('cs_test_secret_789', $res->clientSecret);
        $this->assertEquals('https://checkout.airwallex.com/hosted-flow/int_test_123456', $res->redirectUrl);
    }

    public function test_verifies_valid_webhook_signature(): void
    {
        $secret = 'test_wh_secret_xyz';
        $timestamp = (string) now()->timestamp;
        $payload = json_encode([
            'id' => 'evt_123',
            'name' => 'payment_intent.succeeded',
            'data' => [
                'object' => [
                    'id' => 'int_test_123456',
                    'amount' => 50.00,
                    'currency' => 'USD',
                ],
            ],
        ]);

        $signature = hash_hmac('sha256', $timestamp . $payload, $secret);

        $request = Request::create('/api/v1/webhooks/airwallex', 'POST', [], [], [], [
            'HTTP_X_SIGNATURE' => $signature,
            'HTTP_X_TIMESTAMP' => $timestamp,
            'CONTENT_TYPE' => 'application/json',
        ], $payload);

        $provider = new AirwallexProvider();
        $this->assertTrue($provider->verifyWebhookSignature($request));

        $parsed = $provider->parseWebhookEvent($request);
        $this->assertEquals('airwallex', $parsed->provider);
        $this->assertEquals('evt_123', $parsed->eventId);
        $this->assertEquals('successful', $parsed->status);
        $this->assertEquals(5000, $parsed->amount);
    }

    public function test_rejects_invalid_webhook_signature(): void
    {
        $timestamp = (string) now()->timestamp;
        $payload = json_encode(['id' => 'evt_tampered']);

        $request = Request::create('/api/v1/webhooks/airwallex', 'POST', [], [], [], [
            'HTTP_X_SIGNATURE' => 'invalid_signature_hash',
            'HTTP_X_TIMESTAMP' => $timestamp,
            'CONTENT_TYPE' => 'application/json',
        ], $payload);

        $provider = new AirwallexProvider();
        $this->assertFalse($provider->verifyWebhookSignature($request));
    }
}

