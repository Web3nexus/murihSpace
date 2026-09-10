<?php

namespace Tests\Feature\Payment;

use App\Enums\CapabilityStatus;
use App\Enums\PaymentStatus;
use App\Enums\ProviderHealthStatus;
use App\Models\DigitalProduct;
use App\Models\Payment;
use App\Models\PaymentProvider;
use App\Models\ProviderCapability;
use App\Models\ProviderRoute;
use App\Models\User;
use App\Services\Payment\Contracts\CollectionProviderInterface;
use App\Services\Payment\DTO\PaymentIntentResponse;
use App\Services\Payment\DTO\PaymentVerificationResult;
use App\Services\Payment\Providers\PaystackProvider;
use App\Services\Payment\Router\ProviderRouter;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery;
use Tests\TestCase;

class PaymentFlowTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $paystack = PaymentProvider::create([
            'code' => 'paystack',
            'name' => 'Paystack',
            'is_enabled' => true,
            'health_status' => ProviderHealthStatus::Healthy,
        ]);

        ProviderCapability::create([
            'payment_provider_id' => $paystack->id,
            'capability' => 'card',
            'country_code' => 'NG',
            'currency' => 'NGN',
            'status' => CapabilityStatus::Confirmed,
        ]);

        ProviderRoute::create([
            'name' => 'NGN Card Route',
            'transaction_type' => 'payment',
            'country_code' => 'NG',
            'currency' => 'NGN',
            'payment_method' => 'card',
            'primary_provider_id' => $paystack->id,
            'priority' => 10,
            'is_active' => true,
        ]);
    }

    public function test_can_query_payment_methods(): void
    {
        $res = $this->getJson('/api/v1/payments/methods?currency=NGN&country=NG');
        $res->assertStatus(200);
        $res->assertJsonStructure([
            'success',
            'data' => [
                'currency',
                'country',
                'methods' => [
                    '*' => ['code', 'name', 'icons'],
                ],
            ],
        ]);
    }

    public function test_initializes_payment_intent_with_server_calculation(): void
    {
        $user = User::factory()->create();

        $product = DigitalProduct::create([
            'creator_id' => $user->id,
            'title' => 'Advanced Flutter Mastery',
            'slug' => 'advanced-flutter-mastery',
            'price' => 5000.00,
            'currency' => 'NGN',
            'is_published' => true,
        ]);

        // Mock Paystack Provider to avoid external HTTP calls in test
        $paystackMock = Mockery::mock(PaystackProvider::class, CollectionProviderInterface::class);
        $paystackMock->shouldReceive('providerCode')->andReturn('paystack');
        $paystackMock->shouldReceive('isAvailable')->andReturn(true);
        $paystackMock->shouldReceive('createPaymentIntent')->andReturn(new PaymentIntentResponse(
            provider: 'paystack',
            providerReference: 'PSTK_REF_999',
            redirectUrl: 'https://checkout.paystack.com/mock-redirect'
        ));

        app(ProviderRouter::class)->registerProvider('paystack', $paystackMock);

        $res = $this->actingAs($user)->postJson('/api/v1/payments/initialize', [
            'product_id' => $product->id,
            'payment_method' => 'card',
            'country' => 'NG',
            'currency' => 'NGN',
            'idempotency_key' => 'idempotency-key-test-01',
        ]);

        $res->assertStatus(201);
        $res->assertJsonPath('data.currency', 'NGN');
        $res->assertJsonPath('data.amount', 500000); // 5,000 NGN in kobo
        $res->assertJsonPath('data.redirect_url', 'https://checkout.paystack.com/mock-redirect');

        $this->assertDatabaseHas('payments', [
            'amount' => 500000,
            'currency' => 'NGN',
            'provider' => 'paystack',
            'status' => PaymentStatus::Processing->value,
            'idempotency_key' => 'idempotency-key-test-01',
        ]);
    }

    public function test_anti_frontend_trust_status_check(): void
    {
        $user = User::factory()->create();

        $payment = Payment::create([
            'public_reference' => 'PAY-STATUS-CHECK-01',
            'internal_reference' => 'uuid-status-check',
            'provider' => 'paystack',
            'provider_reference' => 'PSTK_REF_STATUS',
            'customer_id' => $user->id,
            'transaction_type' => 'digital_product',
            'payment_method' => 'card',
            'amount' => 500000,
            'currency' => 'NGN',
            'net_amount' => 500000,
            'status' => PaymentStatus::Processing,
            'idempotency_key' => 'idem-status-01',
        ]);

        // Mock verification returning failed/pending
        $paystackMock = Mockery::mock(PaystackProvider::class, CollectionProviderInterface::class);
        $paystackMock->shouldReceive('providerCode')->andReturn('paystack');
        $paystackMock->shouldReceive('isAvailable')->andReturn(true);
        $paystackMock->shouldReceive('verifyPayment')->andReturn(new PaymentVerificationResult(
            isSuccessful: false,
            status: PaymentStatus::Processing,
            providerReference: 'PSTK_REF_STATUS'
        ));

        app(ProviderRouter::class)->registerProvider('paystack', $paystackMock);

        // When client queries status, it must still report processing — never client-faked success
        $res = $this->getJson('/api/v1/payments/PAY-STATUS-CHECK-01/status');
        $res->assertStatus(200);
        $res->assertJsonPath('data.status', 'processing');
    }
}
