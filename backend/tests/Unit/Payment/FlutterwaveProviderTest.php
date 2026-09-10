<?php

namespace Tests\Unit\Payment;

use App\Services\Payment\DTO\PaymentIntentRequest;
use App\Services\Payment\Providers\FlutterwaveProvider;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class FlutterwaveProviderTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        config([
            'payments.providers.flutterwave.enabled' => true,
            'payments.providers.flutterwave.public_key' => 'FLWPUBK_TEST-123456',
            'payments.providers.flutterwave.secret_key' => 'FLWSECK_TEST-abcdef123456',
            'payments.providers.flutterwave.webhook_secret_hash' => 'my_flw_secret_hash_value',
            'payments.providers.flutterwave.base_url' => 'https://api.flutterwave.com/v3',
        ]);
    }

    public function test_creates_flutterwave_payment_hosted_link(): void
    {
        Http::fake([
            'https://api.flutterwave.com/v3/payments' => Http::response([
                'status' => 'success',
                'message' => 'Hosted Link',
                'data' => [
                    'link' => 'https://checkout.flutterwave.com/v3/hosted/pay/test12345',
                ],
            ], 200),
        ]);

        $provider = new FlutterwaveProvider();
        $this->assertTrue($provider->isAvailable());

        $req = new PaymentIntentRequest(
            internalReference: 'uuid-5555-6666',
            publicReference: 'PAY-20260908-FLW999',
            amount: 750000, // 7,500 NGN in kobo
            currency: 'NGN',
            paymentMethod: 'card',
            customerEmail: 'amina@example.com',
            customerName: 'Amina Bello',
            returnUrl: 'https://murihspace.com/checkout/callback'
        );

        $res = $provider->createPaymentIntent($req);

        $this->assertEquals('flutterwave', $res->provider);
        $this->assertEquals('PAY-20260908-FLW999', $res->providerReference);
        $this->assertEquals('https://checkout.flutterwave.com/v3/hosted/pay/test12345', $res->redirectUrl);
    }

    public function test_mandatory_server_side_reverification(): void
    {
        Http::fake([
            'https://api.flutterwave.com/v3/transactions/123456/verify' => Http::response([
                'status' => 'success',
                'data' => [
                    'id' => 123456,
                    'tx_ref' => 'PAY-20260908-FLW999',
                    'amount' => 7500, // Standard unit NGN 7,500
                    'currency' => 'NGN',
                    'status' => 'successful',
                    'processor_response' => 'Approved',
                ],
            ], 200),
        ]);

        $provider = new FlutterwaveProvider();
        $res = $provider->verifyPayment('123456');

        $this->assertTrue($res->isSuccessful);
        $this->assertEquals('PAY-20260908-FLW999', $res->providerReference);
        $this->assertEquals(750000, $res->amount); // Converted to kobo minor units
        $this->assertEquals('NGN', $res->currency);
    }

    public function test_verifies_valid_flutterwave_webhook_hash(): void
    {
        $hash = 'my_flw_secret_hash_value';
        $payload = json_encode([
            'event' => 'charge.completed',
            'data' => [
                'id' => 123456,
                'tx_ref' => 'PAY-20260908-FLW999',
                'status' => 'successful',
                'amount' => 7500,
                'currency' => 'NGN',
            ],
        ]);

        $request = Request::create('/api/v1/webhooks/flutterwave', 'POST', [], [], [], [
            'HTTP_VERIF_HASH' => $hash,
            'CONTENT_TYPE' => 'application/json',
        ], $payload);

        $provider = new FlutterwaveProvider();
        $this->assertTrue($provider->verifyWebhookSignature($request));

        $parsed = $provider->parseWebhookEvent($request);
        $this->assertEquals('flutterwave', $parsed->provider);
        $this->assertEquals('123456', $parsed->eventId);
        $this->assertEquals('successful', $parsed->status);
    }

    public function test_rejects_invalid_flutterwave_webhook_hash(): void
    {
        $payload = json_encode(['event' => 'charge.completed']);

        $request = Request::create('/api/v1/webhooks/flutterwave', 'POST', [], [], [], [
            'HTTP_VERIF_HASH' => 'forged_hash_value',
            'CONTENT_TYPE' => 'application/json',
        ], $payload);

        $provider = new FlutterwaveProvider();
        $this->assertFalse($provider->verifyWebhookSignature($request));
    }
}

