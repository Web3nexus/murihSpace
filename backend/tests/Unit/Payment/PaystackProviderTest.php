<?php

namespace Tests\Unit\Payment;

use App\Services\Payment\DTO\PaymentIntentRequest;
use App\Services\Payment\Providers\PaystackProvider;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class PaystackProviderTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        config([
            'payments.providers.paystack.enabled' => true,
            'payments.providers.paystack.public_key' => 'pk_test_123456',
            'payments.providers.paystack.secret_key' => 'sk_test_abcdef123456',
            'payments.providers.paystack.base_url' => 'https://api.paystack.co',
        ]);
    }

    public function test_initializes_transaction_with_kobo_minor_units(): void
    {
        Http::fake([
            'https://api.paystack.co/transaction/initialize' => Http::response([
                'status' => true,
                'message' => 'Authorization URL created',
                'data' => [
                    'authorization_url' => 'https://checkout.paystack.com/0123456789',
                    'access_code' => 'access_code_999',
                    'reference' => 'PAY-20260908-XYZ999',
                ],
            ], 200),
        ]);

        $provider = new PaystackProvider();
        $this->assertTrue($provider->isAvailable());

        $req = new PaymentIntentRequest(
            internalReference: 'uuid-3333-4444',
            publicReference: 'PAY-20260908-XYZ999',
            amount: 500000, // 5,000 NGN in kobo
            currency: 'NGN',
            paymentMethod: 'card',
            customerEmail: 'customer@example.com',
            customerName: 'Chidi Okonkwo',
            returnUrl: 'https://murihspace.com/checkout/callback'
        );

        $res = $provider->createPaymentIntent($req);

        $this->assertEquals('paystack', $res->provider);
        $this->assertEquals('PAY-20260908-XYZ999', $res->providerReference);
        $this->assertEquals('https://checkout.paystack.com/0123456789', $res->redirectUrl);
    }

    public function test_verifies_valid_paystack_webhook_signature(): void
    {
        $secretKey = 'sk_test_abcdef123456';
        $payload = json_encode([
            'event' => 'charge.success',
            'data' => [
                'id' => 987654321,
                'reference' => 'PAY-20260908-XYZ999',
                'amount' => 500000,
                'currency' => 'NGN',
                'status' => 'success',
                'paid_at' => now()->toISOString(),
            ],
        ]);

        $signature = hash_hmac('sha512', $payload, $secretKey);

        $request = Request::create('/api/v1/webhooks/paystack', 'POST', [], [], [], [
            'HTTP_X_PAYSTACK_SIGNATURE' => $signature,
            'CONTENT_TYPE' => 'application/json',
        ], $payload);

        $provider = new PaystackProvider();
        $this->assertTrue($provider->verifyWebhookSignature($request));

        $parsed = $provider->parseWebhookEvent($request);
        $this->assertEquals('paystack', $parsed->provider);
        $this->assertEquals('987654321', $parsed->eventId);
        $this->assertEquals('PAY-20260908-XYZ999', $parsed->resourceReference);
        $this->assertEquals('successful', $parsed->status);
        $this->assertEquals(500000, $parsed->amount);
    }

    public function test_rejects_invalid_paystack_webhook_signature(): void
    {
        $payload = json_encode(['event' => 'charge.success']);

        $request = Request::create('/api/v1/webhooks/paystack', 'POST', [], [], [], [
            'HTTP_X_PAYSTACK_SIGNATURE' => 'fraudulent_tampered_signature',
            'CONTENT_TYPE' => 'application/json',
        ], $payload);

        $provider = new PaystackProvider();
        $this->assertFalse($provider->verifyWebhookSignature($request));
    }
}

