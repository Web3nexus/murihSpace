<?php

namespace Tests\Unit\Payment;

use App\Services\Payment\DTO\PaymentIntentRequest;
use App\Services\Payment\Exceptions\PaymentException;
use App\Services\Payment\Providers\PaddleProvider;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class PaddleProviderTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        config([
            'payments.providers.paddle.enabled' => true,
            'payments.providers.paddle.environment' => 'sandbox',
            'payments.providers.paddle.client_token' => 'client_123456',
            'payments.providers.paddle.vendor_id' => '12345',
            'payments.providers.paddle.api_key' => 'pdl_test_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
            'payments.providers.paddle.webhook_public_key' => '5c2a9c6d7f4e8b1a3d5f7g8h2j4k6l8n',
            'payments.providers.paddle.handles_tax' => true,
        ]);
    }

    public function test_provider_information_and_availability(): void
    {
        $provider = new PaddleProvider();

        $this->assertSame('paddle', $provider->providerCode());
        $this->assertTrue($provider->isAvailable());
        $this->assertTrue($provider->handlesTax());
    }

    public function test_unavailable_without_api_key(): void
    {
        config(['payments.providers.paddle.api_key' => null]);
        $provider = new PaddleProvider();

        $this->assertFalse($provider->isAvailable());
    }

    public function test_creates_transaction_with_major_unit_amount(): void
    {
        Http::fake([
            'https://sandbox-api.paddle.com/transactions' => Http::response([
                'data' => [
                    'id' => 'txn_01JX3Z7EXAMPLE',
                    'checkout' => ['url' => 'https://checkout.paddle.com/checkout/txn_01JX3Z7EXAMPLE'],
                    'details' => ['totals' => ['subtotal' => '25.00', 'tax' => '2.00', 'total' => '27.00']],
                ],
            ], 201),
        ]);

        $provider = new PaddleProvider();
        $req = new PaymentIntentRequest(
            internalReference: 'uuid-1234',
            publicReference: 'PAY-20260920-ABC123',
            amount: 2500, // $25.00 in cents
            currency: 'USD',
            paymentMethod: 'card',
            customerEmail: 'buyer@example.com',
            customerName: 'Ada Obi',
            returnUrl: 'https://murihspace.com/checkout/callback',
            metadata: ['coin_pack_id' => 3],
            idempotencyKey: 'idem-1'
        );

        $res = $provider->createPaymentIntent($req);

        $this->assertSame('paddle', $res->provider);
        $this->assertSame('txn_01JX3Z7EXAMPLE', $res->providerReference);
        $this->assertStringStartsWith('https://checkout.paddle.com', $res->redirectUrl);

        Http::assertSent(function ($request) {
            $body = $request->data();
            return $request->url() === 'https://sandbox-api.paddle.com/transactions'
                && $body['items'][0]['price']['unit_price']['amount'] === '25.00'
                && $body['items'][0]['price']['unit_price']['currency_code'] === 'USD'
                && $body['custom_data']['public_reference'] === 'PAY-20260920-ABC123'
                && $body['custom_data']['coin_pack_id'] === 3;
        });
    }

    public function test_create_payment_intent_failure_throws(): void
    {
        Http::fake([
            'https://sandbox-api.paddle.com/transactions' => Http::response([
                'error' => ['detail' => 'Amount is below the minimum.'],
            ], 422),
        ]);

        $provider = new PaddleProvider();
        $req = new PaymentIntentRequest(
            internalReference: 'uuid-1',
            publicReference: 'PAY-X',
            amount: 100,
            currency: 'USD',
            paymentMethod: 'card',
            customerEmail: 'a@b.com'
        );

        $this->expectException(PaymentException::class);
        $provider->createPaymentIntent($req);
    }

    public function test_verifies_completed_transaction_with_subtotal_amount(): void
    {
        Http::fake([
            'https://sandbox-api.paddle.com/transactions/*' => Http::response([
                'data' => [
                    'id' => 'txn_01JX3Z7EXAMPLE',
                    'status' => 'completed',
                    'currency_code' => 'USD',
                    'details' => ['totals' => ['subtotal' => '25.00', 'tax' => '2.00', 'total' => '27.00']],
                ],
            ], 200),
        ]);

        $provider = new PaddleProvider();
        $result = $provider->verifyPayment('txn_01JX3Z7EXAMPLE');

        $this->assertTrue($result->isSuccessful);
        $this->assertSame(2500, $result->amount); // pre-tax subtotal
        $this->assertSame('USD', $result->currency);
    }

    public function test_rejects_tampered_webhook_signature(): void
    {
        $payload = json_encode(['event_type' => 'transaction.completed', 'data' => ['id' => 'txn_1']]);

        $request = Request::create('/api/v1/webhooks/paddle', 'POST', [], [], [], [
            'HTTP_PADDLE_WEBHOOK_SIGNATURE' => 'ts='.time().';h1='.base64_encode('tampered-sig'),
            'CONTENT_TYPE' => 'application/json',
        ], $payload);

        $provider = new PaddleProvider();
        $this->assertFalse($provider->verifyWebhookSignature($request));
    }

    public function test_parses_completed_webhook_event(): void
    {
        $payload = json_encode([
            'event_type' => 'transaction.completed',
            'data' => [
                'id' => 'txn_01JX3Z7EVENT',
                'status' => 'completed',
                'currency_code' => 'USD',
                'custom_data' => ['internal_reference' => 'uuid-1234'],
                'details' => ['totals' => ['gross' => '27.00', 'subtotal' => '25.00']],
            ],
        ]);

        $request = Request::create('/api/v1/webhooks/paddle', 'POST', [], [], [], [
            'CONTENT_TYPE' => 'application/json',
        ], $payload);

        $provider = new PaddleProvider();
        $event = $provider->parseWebhookEvent($request);

        $this->assertSame('paddle', $event->provider);
        $this->assertSame('txn_01JX3Z7EVENT', $event->eventId);
        $this->assertSame('uuid-1234', $event->resourceReference);
        $this->assertSame('successful', $event->status);
        $this->assertSame(2700, $event->amount);
    }

    public function test_supports_currencies_for_cards(): void
    {
        $provider = new PaddleProvider();

        $this->assertTrue($provider->supports('card', 'USD'));
        $this->assertTrue($provider->supports('card', 'EUR'));
        $this->assertTrue($provider->supports('card', 'GBP'));
        $this->assertFalse($provider->supports('card', 'NGN'));
        $this->assertSame(['USD', 'EUR', 'GBP'], $provider->supportedCurrencies());
    }

    public function test_supports_apple_pay_and_google_pay_wallets(): void
    {
        $provider = new PaddleProvider();

        $this->assertTrue($provider->supports('apple_pay', 'USD'));
        $this->assertTrue($provider->supports('apple_pay', 'EUR'));
        $this->assertTrue($provider->supports('google_pay', 'GBP'));
        $this->assertFalse($provider->supports('apple_pay', 'NGN'));
        $this->assertFalse($provider->supports('bank_transfer', 'USD'));
    }
}