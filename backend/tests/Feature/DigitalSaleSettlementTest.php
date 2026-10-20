<?php

namespace Tests\Feature;

use App\Models\DigitalProduct;
use App\Models\DigitalSaleSettlement;
use App\Models\KycPendingEarning;
use App\Models\Order;
use App\Models\User;
use App\Models\Wallet;
use App\Services\Payment\LiveExchangeRateService;
use App\Services\Wallet\DigitalSaleService;
use App\Services\Wallet\WalletService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\ActsAsSession;
use Tests\TestCase;

class DigitalSaleSettlementTest extends TestCase
{
    use ActsAsSession;
    use RefreshDatabase;

    private Carbon $start;

    protected function setUp(): void
    {
        parent::setUp();
        $this->start = Carbon::parse('2026-10-19 09:00:00');
        Carbon::setTestNow($this->start);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function creator(bool $verified): User
    {
        $platform = User::factory()->create(['role' => 'admin']);
        config()->set('wallet.platform_revenue_user_id', $platform->id);

        $creator = User::factory()->create(['role' => 'creator', 'kyc_status' => $verified ? 'verified' : 'not_started']);
        (new WalletService())->getOrCreateWallet($creator, 'creator');

        return $creator;
    }

    private function paidOrder(User $creator, string $currency = 'USD', float $subtotal = 100.00, float $fee = 10.00): Order
    {
        $buyer = User::factory()->create(['role' => 'member']);
        $product = DigitalProduct::create([
            'creator_id' => $creator->id,
            'title' => 'Preset pack',
            'slug' => 'preset-'.uniqid(),
            'price' => $subtotal,
        ]);

        return Order::create([
            'order_number' => 'ORD-'.uniqid(),
            'buyer_id' => $buyer->id,
            'creator_id' => $creator->id,
            'product_id' => $product->id,
            'idempotency_key' => 'key-'.uniqid(),
            'subtotal' => $subtotal,
            'platform_fee' => $fee,
            'tax' => 0,
            'total' => $subtotal,
            'currency' => $currency,
            'status' => 'completed',
            'paid_at' => $this->start,
        ]);
    }

    private function wallet(User $user): Wallet
    {
        return Wallet::where('user_id', $user->id)->where('wallet_type', 'creator')->firstOrFail()->fresh();
    }

    public function test_a_usd_sale_is_held_in_pending_as_the_seller_share(): void
    {
        $creator = $this->creator(true);
        $order = $this->paidOrder($creator);

        $settlement = app(DigitalSaleService::class)->settleOrder($order);

        $this->assertSame(8000, (int) $settlement->credited_usd);
        $this->assertSame(8000, (int) $this->wallet($creator)->pending);
        $this->assertSame(0, (int) $this->wallet($creator)->withdrawable);
        $this->assertEquals($this->start->copy()->addHours(48)->toIso8601String(), $settlement->release_at->toIso8601String());
    }

    public function test_settling_the_same_order_twice_credits_once(): void
    {
        $creator = $this->creator(true);
        $order = $this->paidOrder($creator);

        app(DigitalSaleService::class)->settleOrder($order);
        app(DigitalSaleService::class)->settleOrder($order);

        $this->assertSame(8000, (int) $this->wallet($creator)->pending);
        $this->assertSame(1, DigitalSaleSettlement::where('order_id', $order->id)->count());
    }

    public function test_a_non_usd_sale_is_converted_to_usd_with_the_provider_rate(): void
    {
        $this->mock(LiveExchangeRateService::class, function ($mock) {
            // Net, seller fee and buyer fee are each converted.
            $mock->shouldReceive('convert')->times(3)->andReturn([
                'rate' => 0.0006, 'converted_amount' => 5400, 'converted_major' => 54.00,
            ]);
        });
        $creator = $this->creator(true);
        $order = $this->paidOrder($creator, 'NGN', 100000.00, 10000.00);

        $settlement = app(DigitalSaleService::class)->settleOrder($order);

        $this->assertSame('NGN', $settlement->order_currency);
        $this->assertSame(5400, (int) $settlement->gross_usd);
        $this->assertSame(5400, (int) $this->wallet($creator)->pending);
    }

    public function test_the_fee_rate_in_force_at_sale_time_is_snapshotted_and_recorded(): void
    {
        $creator = $this->creator(true);
        $order = $this->paidOrder($creator, 'USD', 100.00, 10.00);

        $settlement = app(DigitalSaleService::class)->settleOrder($order);

        // Seller pays 20% of the subtotal. Buyer pays the flat 5% fee on top at checkout.
        $this->assertEquals(20.0, (float) $settlement->seller_fee_rate);
        $this->assertSame(2000, (int) $settlement->seller_fee_usd);
        $this->assertSame(1000, (int) $settlement->buyer_fee_usd);
        $this->assertSame(8000, (int) $settlement->gross_usd, 'The seller share is the subtotal less the seller fee.');
        $this->assertDatabaseHas('ledger_transactions', ['idempotency_key' => "DIGITAL_FEES_{$order->id}"]);
    }

    public function test_a_due_sale_with_no_dispute_is_released_to_a_verified_seller(): void
    {
        $creator = $this->creator(true);
        $order = $this->paidOrder($creator);
        app(DigitalSaleService::class)->settleOrder($order);

        Carbon::setTestNow($this->start->copy()->addHours(49));
        $this->assertSame(1, app(DigitalSaleService::class)->releaseDue());

        $this->assertSame(8000, (int) $this->wallet($creator)->withdrawable);
        $this->assertSame(0, (int) $this->wallet($creator)->pending);
    }

    public function test_a_due_sale_for_an_unverified_seller_waits_for_kyc(): void
    {
        $creator = $this->creator(false);
        $order = $this->paidOrder($creator);
        app(DigitalSaleService::class)->settleOrder($order);

        Carbon::setTestNow($this->start->copy()->addHours(49));
        app(DigitalSaleService::class)->releaseDue();

        $this->assertSame(8000, (int) $this->wallet($creator)->pending);
        $this->assertSame(1, KycPendingEarning::where('user_id', $creator->id)->whereNull('swept_at')->count());
    }

    public function test_a_buyer_dispute_within_48_hours_holds_the_sale_and_it_is_not_released(): void
    {
        $creator = $this->creator(true);
        $order = $this->paidOrder($creator);
        app(DigitalSaleService::class)->settleOrder($order);

        $this->actingAsSession($order->buyer)
            ->postJson("/api/v1/orders/{$order->id}/dispute")
            ->assertOk();

        Carbon::setTestNow($this->start->copy()->addHours(49));
        $this->assertSame(0, app(DigitalSaleService::class)->releaseDue());
        $this->assertSame('disputed', DigitalSaleSettlement::where('order_id', $order->id)->first()->status);
    }

    public function test_a_buyer_dispute_after_48_hours_is_refused(): void
    {
        $creator = $this->creator(true);
        $order = $this->paidOrder($creator);
        app(DigitalSaleService::class)->settleOrder($order);

        Carbon::setTestNow($this->start->copy()->addHours(49));
        $this->actingAsSession($order->buyer)
            ->postJson("/api/v1/orders/{$order->id}/dispute")
            ->assertStatus(422);
    }

    public function test_a_chargeback_after_release_holds_the_amount_and_seller_win_returns_it(): void
    {
        $creator = $this->creator(true);
        $order = $this->paidOrder($creator);
        app(DigitalSaleService::class)->settleOrder($order);
        Carbon::setTestNow($this->start->copy()->addHours(49));
        app(DigitalSaleService::class)->releaseDue();

        $service = app(DigitalSaleService::class);
        $held = $service->openDispute($order, 'chargeback');

        $this->assertSame(8000, (int) $held->held_usd);
        $this->assertSame(8000, (int) $this->wallet($creator)->disputed);
        $this->assertSame(0, (int) $this->wallet($creator)->withdrawable, 'The held amount cannot be withdrawn.');

        $service->resolve($held, 'seller_won');
        $this->assertSame(0, (int) $this->wallet($creator)->disputed);
        $this->assertSame(8000, (int) $this->wallet($creator)->withdrawable);
    }

    public function test_a_chargeback_lost_by_the_seller_claws_back_the_held_amount(): void
    {
        $creator = $this->creator(true);
        $order = $this->paidOrder($creator);
        app(DigitalSaleService::class)->settleOrder($order);
        Carbon::setTestNow($this->start->copy()->addHours(49));
        app(DigitalSaleService::class)->releaseDue();

        $service = app(DigitalSaleService::class);
        $held = $service->openDispute($order, 'chargeback');
        $resolved = $service->resolve($held, 'buyer_won');

        $this->assertSame('reversed', $resolved->status);
        $this->assertTrue($resolved->provider_refund_required);
        $wallet = $this->wallet($creator);
        $this->assertSame(0, (int) $wallet->disputed);
        $this->assertSame(0, (int) $wallet->withdrawable);
        $this->assertSame(0, (int) $wallet->debt);
    }

    public function test_a_clawback_larger_than_what_the_seller_holds_becomes_debt(): void
    {
        $creator = $this->creator(true);
        $order = $this->paidOrder($creator);
        app(DigitalSaleService::class)->settleOrder($order);
        Carbon::setTestNow($this->start->copy()->addHours(49));
        app(DigitalSaleService::class)->releaseDue();

        // The seller withdraws most of the money before the chargeback arrives.
        $this->wallet($creator);
        Wallet::where('user_id', $creator->id)->where('wallet_type', 'creator')->update(['withdrawable' => 2000]);

        $service = app(DigitalSaleService::class);
        $held = $service->openDispute($order, 'chargeback');
        $this->assertSame(2000, (int) $held->held_usd);

        $service->resolve($held, 'buyer_won');

        $this->assertSame(6000, (int) $this->wallet($creator)->debt, 'The amount not covered by the hold is recorded as debt.');
    }

    public function test_a_disputed_sale_blocks_withdrawal(): void
    {
        $creator = $this->creator(true);
        $order = $this->paidOrder($creator);
        app(DigitalSaleService::class)->settleOrder($order);

        $this->actingAsSession($order->buyer)->postJson("/api/v1/orders/{$order->id}/dispute")->assertOk();

        Wallet::where('user_id', $creator->id)->where('wallet_type', 'creator')->update(['withdrawable' => 20000, 'pin_hash' => bcrypt('1234')]);
        $this->actingAsSession($creator)
            ->postJson('/api/v1/wallet/withdrawals', ['wallet_type' => 'creator', 'amount' => 10000, 'pin' => '1234'])
            ->assertStatus(403)
            ->assertJsonPath('errors.code', 'FUNDS_ON_HOLD');
    }
}
