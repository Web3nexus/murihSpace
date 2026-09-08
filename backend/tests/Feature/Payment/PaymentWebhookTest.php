<?php

namespace Tests\Feature\Payment;

use App\Enums\PaymentStatus;
use App\Jobs\ProcessPaymentWebhookJob;
use App\Models\Payment;
use App\Models\PaymentWebhookEvent;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

class PaymentWebhookTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Queue::fake([ProcessPaymentWebhookJob::class]);
        config([
            'payments.providers.paystack.enabled' => true,
            'payments.providers.paystack.secret_key' => 'sk_test_paystack_secret',
            'payments.providers.flutterwave.enabled' => true,
            'payments.providers.flutterwave.webhook_secret_hash' => 'secret_flw_hash',
            'payments.providers.airwallex.enabled' => true,
            'payments.providers.airwallex.webhook_secret' => 'secret_awx_key',
        ]);
    }

    public function test_paystack_webhook_ingestion_and_deduplication(): void
    {
        $user = User::factory()->create();

        $payment = Payment::create([
            'public_reference' => 'PAY-2026-TEST01',
            'internal_reference' => 'uuid-webhook-test',
            'provider' => 'paystack',
            'provider_reference' => 'PAY-2026-TEST01',
            'customer_id' => $user->id,
            'transaction_type' => 'digital_product',
            'payment_method' => 'card',
            'amount' => 500000,
            'currency' => 'NGN',
            'net_amount' => 500000,
            'status' => PaymentStatus::Pending,
            'idempotency_key' => 'idem-wh-01',
        ]);

        $payload = json_encode([
            'event' => 'charge.success',
            'data' => [
                'id' => 888777,
                'reference' => 'PAY-2026-TEST01',
                'amount' => 500000,
                'currency' => 'NGN',
                'status' => 'success',
            ],
        ]);

        $signature = hash_hmac('sha512', $payload, 'sk_test_paystack_secret');

        // First call: Should accept and queue event
        $res1 = $this->withHeaders([
            'x-paystack-signature' => $signature,
            'Content-Type' => 'application/json',
        ])->postJson('/api/v1/webhooks/paystack', json_decode($payload, true));

        $res1->assertStatus(200);
        $this->assertDatabaseHas('payment_webhook_events', [
            'provider' => 'paystack',
            'provider_event_id' => '888777',
            'signature_verified' => true,
        ]);

        // Duplicate call with exact same event ID: Should acknowledge idempotently
        $res2 = $this->withHeaders([
            'x-paystack-signature' => $signature,
            'Content-Type' => 'application/json',
        ])->postJson('/api/v1/webhooks/paystack', json_decode($payload, true));

        $res2->assertStatus(200);
        $res2->assertJsonPath('data.status', 'acknowledged');

        // Only 1 record in payment_webhook_events
        $this->assertEquals(1, PaymentWebhookEvent::where('provider', 'paystack')->where('provider_event_id', '888777')->count());
    }

    public function test_rejects_unauthorized_tampered_webhooks(): void
    {
        $payload = ['event' => 'charge.success'];

        $res = $this->withHeaders([
            'x-paystack-signature' => 'invalid_forged_signature',
        ])->postJson('/api/v1/webhooks/paystack', $payload);

        $res->assertStatus(401);
    }
}
