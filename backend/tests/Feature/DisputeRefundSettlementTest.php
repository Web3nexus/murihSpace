<?php

namespace Tests\Feature;

use App\Enums\PaymentStatus;
use App\Enums\RefundStatus;
use App\Models\DigitalProduct;
use App\Models\DisputeRefund;
use App\Models\Order;
use App\Models\Payment;
use App\Models\Refund;
use App\Models\User;
use App\Models\Wallet;
use App\Models\WalletHold;
use App\Services\Payment\Contracts\RefundStatusProviderInterface;
use App\Services\Payment\Providers\PaystackProvider;
use App\Services\Payment\RefundService;
use App\Services\Payment\Router\ProviderRouter;
use App\Services\Wallet\DigitalSaleService;
use App\Services\Wallet\LedgerService;
use App\Services\Wallet\WalletService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\ActsAsSession;
use Tests\TestCase;

class DisputeRefundSettlementTest extends TestCase
{
    use ActsAsSession;
    use RefreshDatabase;

    private const SECRET = 'sk_test_sample';

    private Carbon $start;

    protected function setUp(): void
    {
        parent::setUp();
        $this->start = Carbon::parse('2026-10-19 09:00:00');
        Carbon::setTestNow($this->start);
        $platform = User::factory()->create(['role' => 'admin']);
        config()->set('wallet.platform_revenue_user_id', $platform->id);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    /**
     * A won dispute: the buyer's 100.00 USD refund is in their system balance (available), and the card
     * payment that a refund must go back to is recorded.
     *
     * @return array{0: User, 1: DisputeRefund, 2: Payment}
     */
    private function wonDispute(): array
    {
        $creator = User::factory()->create(['role' => 'creator', 'kyc_status' => 'verified']);
        (new WalletService())->getOrCreateWallet($creator, 'creator');
        $buyer = User::factory()->create(['role' => 'member']);
        (new WalletService())->getOrCreateWallet($buyer, 'system');

        $product = DigitalProduct::create(['creator_id' => $creator->id, 'title' => 'Pack', 'slug' => 'pack-'.uniqid(), 'price' => 100]);
        $order = Order::create([
            'order_number' => 'ORD-'.uniqid(), 'buyer_id' => $buyer->id, 'creator_id' => $creator->id,
            'product_id' => $product->id, 'idempotency_key' => 'k-'.uniqid(), 'subtotal' => 100, 'platform_fee' => 5,
            'tax' => 0, 'total' => 105, 'currency' => 'USD', 'status' => 'completed', 'paid_at' => $this->start,
            'payment_intent_id' => 'pi_'.uniqid(),
        ]);
        $payment = Payment::create([
            'provider' => 'paystack', 'user_id' => $buyer->id, 'transaction_type' => 'digital_product',
            'payment_method' => 'card', 'amount' => 10500, 'currency' => 'USD', 'fees' => 0,
            'net_amount' => 10500, 'status' => PaymentStatus::Successful, 'idempotency_key' => 'p-'.uniqid(),
            'provider_transaction_id' => $order->payment_intent_id, 'metadata' => [],
        ]);

        $service = app(DigitalSaleService::class);
        $service->settleOrder($order);
        $service->resolve($service->openDispute($order, 'chargeback'), 'buyer_won');
        $row = DisputeRefund::where('order_id', $order->id)->firstOrFail();

        return [$buyer, $row, $payment];
    }

    private function balance(User $buyer, string $column): int
    {
        return (int) Wallet::where('user_id', $buyer->id)->where('wallet_type', 'system')->value($column);
    }

    /**
     * The state the controller leaves when the provider accepts a refund as pending: the balance is held
     * and a provider refund row is waiting for its result.
     */
    private function pendingRefund(User $buyer, DisputeRefund $row, Payment $payment, string $providerRefundId = 'rf_9'): Refund
    {
        app(LedgerService::class)->placeHold(
            user: $buyer,
            amount: (int) $row->amount_usd,
            walletType: 'system',
            balanceCategory: 'reserved',
            reason: "Dispute refund to card awaiting provider confirmation for order #{$row->order_id}",
            refType: 'dispute_refund',
            refId: (string) $row->id,
        );

        return Refund::create([
            'payment_id' => $payment->id,
            'amount' => 10000,
            'currency' => 'USD',
            'reason' => "Dispute won: refund to original card for order #{$row->order_id}",
            'provider' => 'paystack',
            'provider_refund_id' => $providerRefundId,
            'status' => RefundStatus::Processing,
            'idempotency_key' => "DISPUTE_CARD_REFUND_{$row->id}",
        ]);
    }

    public function test_pending_then_success_debits_the_balance_once(): void
    {
        [$buyer, $row, $payment] = $this->wonDispute();
        $refund = $this->pendingRefund($buyer, $row, $payment);

        $this->assertSame(10000, $this->balance($buyer, 'reserved'));
        $this->assertSame(0, $this->balance($buyer, 'available'));

        app(RefundService::class)->applyProviderResult($refund, RefundStatus::Successful);

        $this->assertSame('refunded_to_card', $row->fresh()->status);
        $this->assertSame(0, $this->balance($buyer, 'reserved'));
        $this->assertSame(0, $this->balance($buyer, 'available'));
        $this->assertSame(0, WalletHold::where('reference_type', 'dispute_refund')->where('status', 'active')->count());

        // The same result again (a duplicate webhook) must not debit again.
        app(RefundService::class)->applyWebhookOutcome('paystack', [
            'provider_refund_id' => 'rf_9', 'outcome' => 'successful', 'event_type' => 'refund.processed',
        ]);
        $this->assertSame(0, $this->balance($buyer, 'available'));
        $this->assertSame(0, $this->balance($buyer, 'reserved'));
        $this->assertSame(1, \App\Models\AuditLog::where('action', 'refund.settled')->count());
    }

    public function test_pending_then_failure_releases_the_hold_back_to_available(): void
    {
        [$buyer, $row, $payment] = $this->wonDispute();
        $refund = $this->pendingRefund($buyer, $row, $payment);

        app(RefundService::class)->applyProviderResult($refund, RefundStatus::Failed, 'Card refund declined');

        $this->assertSame('available', $row->fresh()->status);
        $this->assertSame(10000, $this->balance($buyer, 'available'));
        $this->assertSame(0, $this->balance($buyer, 'reserved'));
        $this->assertSame('released', WalletHold::where('reference_type', 'dispute_refund')->firstOrFail()->status);
        $this->assertSame(1, \App\Models\AuditLog::where('action', 'refund.released')->count());

        // A duplicate failure releases nothing again.
        app(RefundService::class)->applyWebhookOutcome('paystack', [
            'provider_refund_id' => 'rf_9', 'outcome' => 'failed', 'event_type' => 'refund.failed',
        ]);
        $this->assertSame(10000, $this->balance($buyer, 'available'));
        $this->assertSame(0, $this->balance($buyer, 'reserved'));
    }

    public function test_a_retry_after_a_failed_refund_is_a_new_provider_request(): void
    {
        [$buyer, $row, $payment] = $this->wonDispute();
        $refund = $this->pendingRefund($buyer, $row, $payment);
        app(RefundService::class)->applyProviderResult($refund, RefundStatus::Failed, 'declined');

        // The retry must not reuse the failed refund's key, which would return the cached failure.
        $this->mock(RefundService::class, function ($mock) {
            $mock->shouldReceive('issueRefund')->once()
                ->withArgs(fn (array $data) => str_ends_with($data['idempotency_key'], '_2'))
                ->andReturn(['success' => true, 'status' => 'processing']);
        });

        $this->actingAsSession($buyer)
            ->postJson("/api/v1/wallet/refund-balances/{$row->id}/refund-to-card")
            ->assertStatus(202);

        $this->assertSame(10000, $this->balance($buyer, 'reserved'));
        $this->assertSame(0, $this->balance($buyer, 'available'));
    }

    /** A Paystack webhook with a valid HMAC-SHA512 signature over the exact body. */
    private function paystackWebhook(array $payload)
    {
        $body = json_encode($payload);

        return $this->call('POST', '/api/v1/webhooks/paystack', [], [], [], [
            'CONTENT_TYPE' => 'application/json',
            'HTTP_X_PAYSTACK_SIGNATURE' => hash_hmac('sha512', $body, self::SECRET),
        ], $body);
    }

    /**
     * A documented refund payload (tests/Fixtures/paystack), pointed at the payment and amount of this test.
     * Refund payloads carry no data.id and no data.reference, so they are matched by transaction_reference.
     */
    private function refundFixture(string $name, Payment $payment, array $data = []): array
    {
        $payload = json_decode(file_get_contents(base_path("tests/Fixtures/paystack/{$name}.json")), true);
        $payload['data'] = array_replace($payload['data'], [
            'transaction_reference' => $payment->provider_transaction_id,
            'amount' => '10000',
            'currency' => 'USD',
        ], $data);

        return $payload;
    }

    private function webhookEvent(string $eventType)
    {
        return \App\Models\PaymentWebhookEvent::where('provider', 'paystack')->where('event_type', $eventType)->latest('id')->firstOrFail();
    }

    public function test_refund_processed_webhook_settles_the_pending_refund_once(): void
    {
        [$buyer, $row, $payment] = $this->wonDispute();
        $this->pendingRefund($buyer, $row, $payment, 'rf_stored_9');

        $payload = $this->refundFixture('refund.processed', $payment);
        $this->paystackWebhook($payload)->assertOk();

        $this->assertSame('refunded_to_card', $row->fresh()->status);
        $this->assertSame(0, $this->balance($buyer, 'available'));
        $this->assertSame(0, $this->balance($buyer, 'reserved'));
        $this->assertSame('completed', $this->webhookEvent('refund.processed')->processing_status);

        // A duplicate delivery is acknowledged and changes nothing.
        $this->paystackWebhook($payload)->assertOk()->assertJsonPath('data.status', 'acknowledged');
        $this->assertSame(0, $this->balance($buyer, 'available'));
        $this->assertSame(0, $this->balance($buyer, 'reserved'));
        $this->assertSame(1, \App\Models\AuditLog::where('action', 'refund.settled')->count());
    }

    public function test_a_duplicate_processed_result_with_a_different_body_is_a_no_op(): void
    {
        [$buyer, $row, $payment] = $this->wonDispute();
        $this->pendingRefund($buyer, $row, $payment);

        $this->paystackWebhook($this->refundFixture('refund.processed', $payment));
        $this->assertSame('refunded_to_card', $row->fresh()->status);

        // Same refund, same transaction, different body (for example a later timestamp): already final.
        $result = app(RefundService::class)->applyWebhookOutcome('paystack', [
            'provider_refund_id' => '', 'refund_reference' => null,
            'transaction_reference' => $payment->provider_transaction_id, 'amount' => 10000, 'currency' => 'USD',
            'outcome' => 'successful', 'event_type' => 'refund.processed',
        ]);
        $this->assertSame('duplicate', $result);
        $this->assertSame(1, \App\Models\AuditLog::where('action', 'refund.settled')->count());
        $this->assertSame(0, $this->balance($buyer, 'available'));
    }

    public function test_refund_failed_webhook_releases_the_hold(): void
    {
        [$buyer, $row, $payment] = $this->wonDispute();
        $this->pendingRefund($buyer, $row, $payment);

        $this->paystackWebhook($this->refundFixture('refund.failed', $payment))->assertOk();

        $this->assertSame('available', $row->fresh()->status);
        $this->assertSame(10000, $this->balance($buyer, 'available'));
        $this->assertSame(0, $this->balance($buyer, 'reserved'));
        $this->assertSame('completed', $this->webhookEvent('refund.failed')->processing_status);
    }

    public function test_refund_processing_and_pending_webhooks_do_not_settle(): void
    {
        [$buyer, $row, $payment] = $this->wonDispute();
        $refund = $this->pendingRefund($buyer, $row, $payment);

        foreach (['refund.processing', 'refund.pending'] as $name) {
            $this->paystackWebhook($this->refundFixture($name, $payment))->assertOk();
        }

        // Recorded, but not treated as results: no hold released, no debit, the refund row is still in flight.
        $this->assertSame(RefundStatus::Processing, $refund->fresh()->status);
        $this->assertSame('available', $row->fresh()->status);
        $this->assertSame(10000, $this->balance($buyer, 'reserved'));
        $this->assertSame(0, $this->balance($buyer, 'available'));
        $this->assertSame(1, WalletHold::where('reference_type', 'dispute_refund')->where('status', 'active')->count());
        $this->assertSame(0, \App\Models\AuditLog::where('action', 'refund.settled')->count());
        $this->assertSame(['ignored', 'ignored'], \App\Models\PaymentWebhookEvent::where('provider', 'paystack')
            ->whereIn('event_type', ['refund.processing', 'refund.pending'])->orderBy('id')->pluck('processing_status')->all());
    }

    public function test_an_unmatched_refund_event_is_recorded_for_review_and_settles_nothing(): void
    {
        [$buyer, $row, $payment] = $this->wonDispute();
        $refund = $this->pendingRefund($buyer, $row, $payment);

        // A refund on a charge we have no open refund for.
        $this->paystackWebhook($this->refundFixture('refund.processed', $payment, ['transaction_reference' => 'PAY-UNKNOWN-1']))->assertOk();

        $this->assertSame('unmatched', $this->webhookEvent('refund.processed')->processing_status);
        $this->assertSame(RefundStatus::Processing, $refund->fresh()->status);
        $this->assertSame(10000, $this->balance($buyer, 'reserved'));
        $this->assertSame(0, $this->balance($buyer, 'available'));
        $this->assertSame('available', $row->fresh()->status);
    }

    public function test_a_refund_event_is_not_matched_when_two_refunds_on_the_payment_are_indistinguishable(): void
    {
        [$buyer, $row, $payment] = $this->wonDispute();
        // A failed attempt, then its retry: two 10000 USD refunds on the same charge.
        Refund::create([
            'payment_id' => $payment->id, 'amount' => 10000, 'currency' => 'USD', 'reason' => 'first attempt',
            'provider' => 'paystack', 'provider_refund_id' => 'rf_first', 'status' => RefundStatus::Failed,
            'idempotency_key' => "DISPUTE_CARD_REFUND_{$row->id}_1",
        ]);
        $second = $this->pendingRefund($buyer, $row, $payment, 'rf_second');

        $this->paystackWebhook($this->refundFixture('refund.processed', $payment))->assertOk();

        // The payload cannot say whether it belongs to the failed attempt or its retry, so neither is settled.
        $this->assertSame('unmatched', $this->webhookEvent('refund.processed')->processing_status);
        $this->assertSame(RefundStatus::Processing, $second->fresh()->status);
        $this->assertSame('available', $row->fresh()->status);
    }

    public function test_a_dispute_event_is_recorded_and_does_not_touch_refunds(): void
    {
        [$buyer, $row, $payment] = $this->wonDispute();
        $refund = $this->pendingRefund($buyer, $row, $payment);

        $payload = json_decode(file_get_contents(base_path('tests/Fixtures/paystack/charge.dispute.resolve.json')), true);
        $this->paystackWebhook($payload)->assertOk();

        $this->assertSame('completed', $this->webhookEvent('charge.dispute.resolve')->processing_status);
        $this->assertSame(RefundStatus::Processing, $refund->fresh()->status);
        $this->assertSame(10000, $this->balance($buyer, 'reserved'));
    }

    public function test_the_reconciliation_command_settles_an_old_pending_refund(): void
    {
        [$buyer, $row, $payment] = $this->wonDispute();
        $this->pendingRefund($buyer, $row, $payment);
        WalletHold::where('reference_type', 'dispute_refund')->update(['created_at' => $this->start->copy()->subDays(2)]);

        $this->mock(ProviderRouter::class, function ($mock) {
            $mock->shouldReceive('getProvider')->with('paystack')->andReturn(new FakeRefundLookupPaystack);
        });

        $this->artisan('refunds:reconcile-pending', ['--hours' => 24])->assertExitCode(0);

        $this->assertSame('refunded_to_card', $row->fresh()->status);
        $this->assertSame(0, $this->balance($buyer, 'reserved'));
        $this->assertSame(0, $this->balance($buyer, 'available'));
    }

    public function test_the_reconciliation_command_leaves_a_recent_pending_refund_alone(): void
    {
        [$buyer, $row, $payment] = $this->wonDispute();
        $refund = $this->pendingRefund($buyer, $row, $payment);

        $this->mock(ProviderRouter::class, function ($mock) {
            $mock->shouldReceive('getProvider')->never();
        });

        $this->artisan('refunds:reconcile-pending', ['--hours' => 24])->assertExitCode(0);

        $this->assertSame(RefundStatus::Processing, $refund->fresh()->status);
        $this->assertSame('available', $row->fresh()->status);
        $this->assertSame(10000, $this->balance($buyer, 'reserved'));
    }
}

/** Stands in for a provider whose refund status lookup confirms success. */
class FakeRefundLookupPaystack extends PaystackProvider implements RefundStatusProviderInterface
{
    public function verifyRefund(string $providerRefundId): ?RefundStatus
    {
        return RefundStatus::Successful;
    }
}
