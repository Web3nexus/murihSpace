<?php

namespace Tests\Feature;

use App\Enums\PaymentStatus;
use App\Models\DigitalProduct;
use App\Models\DisputeRefund;
use App\Models\Order;
use App\Models\Payment;
use App\Models\User;
use App\Models\Wallet;
use App\Models\WalletHold;
use App\Services\Payment\RefundService;
use App\Services\Wallet\DigitalSaleService;
use App\Services\Wallet\WalletService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\ActsAsSession;
use Tests\TestCase;

class DisputeRefundTest extends TestCase
{
    use ActsAsSession;
    use RefreshDatabase;

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

    /** A paid digital order, its card payment, and a settled sale. */
    private function paidOrderWithCard(): array
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
            'provider' => 'paddle', 'user_id' => $buyer->id, 'transaction_type' => 'digital_product',
            'payment_method' => 'card', 'amount' => 10500, 'currency' => 'USD', 'fees' => 0,
            'net_amount' => 10500, 'status' => PaymentStatus::Successful, 'idempotency_key' => 'p-'.uniqid(),
            'provider_transaction_id' => $order->payment_intent_id, 'metadata' => [],
        ]);

        return [$buyer, $creator, $order, $payment];
    }

    public function test_a_won_dispute_credits_the_buyers_balance_and_it_cannot_be_withdrawn(): void
    {
        [$buyer, $creator, $order] = $this->paidOrderWithCard();
        $service = app(DigitalSaleService::class);
        $settlement = $service->settleOrder($order);

        $held = $service->openDispute($order, 'chargeback');
        $service->resolve($held, 'buyer_won');

        $row = DisputeRefund::where('order_id', $order->id)->firstOrFail();
        $this->assertSame('available', $row->status);
        $this->assertSame(10000, (int) $row->amount_usd);
        $this->assertSame(10000, (int) Wallet::where('user_id', $buyer->id)->where('wallet_type', 'system')->value('available'));

        // The buyer's balance is not withdrawable.
        $this->actingAsSession($buyer)
            ->postJson('/api/v1/wallet/withdrawals', ['wallet_type' => 'system', 'amount' => 1000, 'pin' => '1234'])
            ->assertStatus(403);
        $this->assertNotNull($settlement);
    }

    public function test_the_buyer_can_send_the_balance_back_to_the_original_card(): void
    {
        [$buyer, , $order, $payment] = $this->paidOrderWithCard();
        $service = app(DigitalSaleService::class);
        $service->settleOrder($order);
        $service->resolve($service->openDispute($order, 'chargeback'), 'buyer_won');
        $row = DisputeRefund::where('order_id', $order->id)->firstOrFail();

        $this->mock(RefundService::class, function ($mock) use ($payment) {
            $mock->shouldReceive('issueRefund')->once()->withArgs(function (array $data) use ($payment) {
                return $data['payment_id'] === $payment->id && $data['amount'] === 10000;
            })->andReturn(['success' => true, 'status' => 'successful', 'refund_id' => 7, 'public_reference' => 'RF-7']);
        });

        $this->actingAsSession($buyer)
            ->postJson("/api/v1/wallet/refund-balances/{$row->id}/refund-to-card")
            ->assertOk();

        $this->assertSame('refunded_to_card', $row->fresh()->status);
        $this->assertSame(0, (int) Wallet::where('user_id', $buyer->id)->where('wallet_type', 'system')->value('available'));
    }

    public function test_the_balance_is_held_while_the_provider_has_not_confirmed_the_refund(): void
    {
        [$buyer, , $order] = $this->paidOrderWithCard();
        $service = app(DigitalSaleService::class);
        $service->settleOrder($order);
        $service->resolve($service->openDispute($order, 'chargeback'), 'buyer_won');
        $row = DisputeRefund::where('order_id', $order->id)->firstOrFail();

        $this->mock(RefundService::class, function ($mock) {
            $mock->shouldReceive('issueRefund')->once()->andReturn(['success' => true, 'status' => 'processing']);
        });

        $this->actingAsSession($buyer)
            ->postJson("/api/v1/wallet/refund-balances/{$row->id}/refund-to-card")
            ->assertStatus(202);

        // Not debited yet, but no longer spendable: it is held out of available.
        $this->assertSame('available', $row->fresh()->status);
        $this->assertSame(0, $this->systemBalance($buyer, 'available'));
        $this->assertSame(10000, $this->systemBalance($buyer, 'reserved'));
    }

    public function test_a_retry_while_pending_does_not_hold_the_balance_twice(): void
    {
        [$buyer, , $order] = $this->paidOrderWithCard();
        $service = app(DigitalSaleService::class);
        $service->settleOrder($order);
        $service->resolve($service->openDispute($order, 'chargeback'), 'buyer_won');
        $row = DisputeRefund::where('order_id', $order->id)->firstOrFail();

        $this->mock(RefundService::class, function ($mock) {
            $mock->shouldReceive('issueRefund')->twice()->andReturn(['success' => true, 'status' => 'processing']);
        });

        $this->actingAsSession($buyer)->postJson("/api/v1/wallet/refund-balances/{$row->id}/refund-to-card")->assertStatus(202);
        $this->actingAsSession($buyer)->postJson("/api/v1/wallet/refund-balances/{$row->id}/refund-to-card")->assertStatus(202);

        $this->assertSame(10000, $this->systemBalance($buyer, 'reserved'));
        $this->assertSame(1, WalletHold::where('reference_type', 'dispute_refund')->where('status', 'active')->count());
    }

    public function test_a_refund_confirmed_after_a_pending_result_releases_the_hold_and_is_debited_once(): void
    {
        [$buyer, , $order, $payment] = $this->paidOrderWithCard();
        $service = app(DigitalSaleService::class);
        $service->settleOrder($order);
        $service->resolve($service->openDispute($order, 'chargeback'), 'buyer_won');
        $row = DisputeRefund::where('order_id', $order->id)->firstOrFail();

        $this->mock(RefundService::class, function ($mock) use ($payment) {
            $mock->shouldReceive('issueRefund')->twice()->andReturn(
                ['success' => true, 'status' => 'processing'],
                ['success' => true, 'status' => 'successful', 'refund_id' => 7, 'public_reference' => 'RF-7'],
            );
        });

        $this->actingAsSession($buyer)->postJson("/api/v1/wallet/refund-balances/{$row->id}/refund-to-card")->assertStatus(202);
        $this->actingAsSession($buyer)->postJson("/api/v1/wallet/refund-balances/{$row->id}/refund-to-card")->assertOk();

        $this->assertSame('refunded_to_card', $row->fresh()->status);
        $this->assertSame(0, $this->systemBalance($buyer, 'available'));
        $this->assertSame(0, $this->systemBalance($buyer, 'reserved'));
    }

    private function systemBalance(User $user, string $category): int
    {
        return (int) Wallet::where('user_id', $user->id)->where('wallet_type', 'system')->value($category);
    }

    public function test_another_user_cannot_refund_someone_elses_balance(): void
    {
        [, , $order] = $this->paidOrderWithCard();
        $service = app(DigitalSaleService::class);
        $service->settleOrder($order);
        $service->resolve($service->openDispute($order, 'chargeback'), 'buyer_won');
        $row = DisputeRefund::where('order_id', $order->id)->firstOrFail();
        $stranger = User::factory()->create(['role' => 'member']);

        $this->actingAsSession($stranger)
            ->postJson("/api/v1/wallet/refund-balances/{$row->id}/refund-to-card")
            ->assertStatus(403);
    }

    public function test_a_buyer_win_reverses_only_the_seller_fee_and_keeps_the_buyer_fee(): void
    {
        [, , $order] = $this->paidOrderWithCard();
        $platform = User::factory()->create(['role' => 'admin']);
        config(['wallet.platform_revenue_user_id' => $platform->id]);

        $service = app(DigitalSaleService::class);
        $settlement = $service->settleOrder($order);
        $revenue = fn () => (int) Wallet::where('user_id', $platform->id)->where('wallet_type', 'system')->value('available');

        $before = $revenue();
        $service->resolve($service->openDispute($order, 'chargeback'), 'buyer_won');

        $this->assertSame((int) $settlement->seller_fee_usd, $before - $revenue());
        $this->assertSame((int) $settlement->buyer_fee_usd, $revenue());
    }
}
