<?php

namespace Tests\Unit\Payment;

use App\Services\Payment\DTO\PaymentIntentRequest;
use App\Services\Payment\ProviderResultResolver;
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

    public function test_transfer_verify_uses_the_reference_we_sent_not_the_transfer_code(): void
    {
        Http::fake([
            'https://api.paystack.co/transfer/verify/*' => Http::response([
                'status' => true,
                'data' => ['status' => 'success', 'reference' => 'PO-20261020-ABCDEFGH', 'transfer_code' => 'TRF_8c4bnb0iy3qwx9b'],
            ], 200),
        ]);

        $result = (new PaystackProvider())->verifyPayout('PO-20261020-ABCDEFGH');

        Http::assertSent(fn ($request) => $request->method() === 'GET'
            && $request->url() === 'https://api.paystack.co/transfer/verify/PO-20261020-ABCDEFGH');
        Http::assertNotSent(fn ($request) => str_contains($request->url(), 'TRF_'));
        $this->assertSame('successful', $result['status']);
    }

    public function test_transfer_verify_maps_reversed_and_pending_statuses(): void
    {
        Http::fake([
            'https://api.paystack.co/transfer/verify/PO-REVERSED' => Http::response(['status' => true, 'data' => ['status' => 'reversed']], 200),
            'https://api.paystack.co/transfer/verify/PO-PENDING' => Http::response(['status' => true, 'data' => ['status' => 'otp']], 200),
        ]);

        $provider = new PaystackProvider();
        $this->assertSame('failed', $provider->verifyPayout('PO-REVERSED')['status']);
        $this->assertSame('processing', $provider->verifyPayout('PO-PENDING')['status']);
    }

    public function test_refund_processing_and_pending_are_not_results_and_final_refunds_carry_the_matching_fields(): void
    {
        $fixture = fn (string $name) => json_decode(file_get_contents(base_path("tests/Fixtures/paystack/{$name}.json")), true);

        foreach (['refund.processing', 'refund.pending'] as $name) {
            $this->assertNull(ProviderResultResolver::refund('paystack', $name, $fixture($name)));
        }

        $processed = ProviderResultResolver::refund('paystack', 'refund.processed', $fixture('refund.processed'));
        $this->assertSame('successful', $processed['outcome']);
        $this->assertSame('', $processed['provider_refund_id']);
        $this->assertSame('PAY-20261019-XYZ999', $processed['transaction_reference']);
        $this->assertSame(5000, $processed['amount']);
        $this->assertSame('NGN', $processed['currency']);
        $this->assertSame('RFN_0q9ht4qw3l3gq2x', $processed['refund_reference']);

        $failed = ProviderResultResolver::refund('paystack', 'refund.failed', $fixture('refund.failed'));
        $this->assertSame('failed', $failed['outcome']);
        $this->assertNull($failed['refund_reference']);
    }

    public function test_refund_request_sends_the_paystack_charge_reference_not_our_reference(): void
    {
        Http::fake([
            'api.paystack.co/refund' => Http::response([
                'status' => true,
                'message' => 'Refund has been queued for processing',
                'data' => ['id' => 3018284, 'status' => 'pending'],
            ], 200),
        ]);

        $response = app(PaystackProvider::class)->processRefund(new \App\Services\Payment\DTO\RefundRequest(
            internalReference: 'int_1',
            paymentReference: 'PAY-OUR-REF',
            providerPaymentId: 'T685312322670591',
            amount: 10000,
            currency: 'NGN',
            reason: 'Buyer requested refund',
            idempotencyKey: 'refund-key-1',
        ));

        Http::assertSent(fn ($request) => $request->url() === 'https://api.paystack.co/refund'
            && $request['transaction'] === 'T685312322670591');
        $this->assertSame('3018284', $response->providerRefundId);
    }
}
