<?php

namespace Tests\Feature;

use App\Models\DigitalProduct;
use App\Models\DigitalSaleSettlement;
use App\Models\Order;
use App\Models\User;
use App\Services\Payment\ChargebackEventHandler;
use App\Services\Wallet\DigitalSaleService;
use App\Services\Wallet\WalletService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ChargebackEventHandlerTest extends TestCase
{
    use RefreshDatabase;

    private Carbon $start;

    protected function setUp(): void
    {
        parent::setUp();
        $this->start = Carbon::parse('2026-10-19 09:00:00');
        Carbon::setTestNow($this->start);
        config()->set('wallet.platform_revenue_user_id', User::factory()->create(['role' => 'admin'])->id);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    /** A settled digital sale whose order carries the given provider payment reference. */
    private function settledSale(string $reference): Order
    {
        $creator = User::factory()->create(['role' => 'creator', 'kyc_status' => 'verified']);
        (new WalletService())->getOrCreateWallet($creator, 'creator');
        $buyer = User::factory()->create(['role' => 'member']);
        $product = DigitalProduct::create(['creator_id' => $creator->id, 'title' => 'Pack', 'slug' => 'p-'.uniqid(), 'price' => 100]);
        $order = Order::create([
            'order_number' => 'ORD-'.uniqid(), 'buyer_id' => $buyer->id, 'creator_id' => $creator->id,
            'product_id' => $product->id, 'idempotency_key' => 'k-'.uniqid(), 'subtotal' => 100, 'platform_fee' => 5,
            'tax' => 0, 'total' => 105, 'currency' => 'USD', 'status' => 'completed', 'paid_at' => $this->start,
            'payment_intent_id' => $reference,
        ]);
        app(DigitalSaleService::class)->settleOrder($order);

        return $order;
    }

    private function settlement(Order $order): DigitalSaleSettlement
    {
        return DigitalSaleSettlement::where('order_id', $order->id)->firstOrFail()->fresh();
    }

    public function test_stripe_dispute_created_opens_a_chargeback_hold(): void
    {
        $order = $this->settledSale('pi_stripe_1');

        $handled = app(ChargebackEventHandler::class)->handle([
            'type' => 'charge.dispute.created',
            'data' => ['object' => ['id' => 'dp_1', 'payment_intent' => 'pi_stripe_1']],
        ]);

        $this->assertSame('opened', $handled);
        $this->assertSame('disputed', $this->settlement($order)->status);
        $this->assertSame('chargeback', $this->settlement($order)->dispute_source);
    }

    public function test_stripe_dispute_closed_as_won_reverses_the_chargeback(): void
    {
        $order = $this->settledSale('pi_stripe_2');
        app(ChargebackEventHandler::class)->handle(['type' => 'charge.dispute.created', 'data' => ['object' => ['payment_intent' => 'pi_stripe_2']]]);

        $handled = app(ChargebackEventHandler::class)->handle([
            'type' => 'charge.dispute.closed',
            'data' => ['object' => ['payment_intent' => 'pi_stripe_2', 'status' => 'won']],
        ]);

        $this->assertSame('reversed', $handled);
        $this->assertSame('pending', $this->settlement($order)->status);
    }

    public function test_paystack_dispute_create_opens_a_chargeback_hold(): void
    {
        $order = $this->settledSale('PSK_ref_1');

        $handled = app(ChargebackEventHandler::class)->handle([
            'event' => 'charge.dispute.create',
            'data' => ['reference' => 'PSK_ref_1'],
        ]);

        $this->assertSame('opened', $handled);
        $this->assertSame('disputed', $this->settlement($order)->status);
    }

    public function test_paddle_chargeback_adjustment_opens_and_chargeback_reverse_reverses(): void
    {
        $order = $this->settledSale('txn_paddle_1');

        $opened = app(ChargebackEventHandler::class)->handle([
            'event_type' => 'adjustment.created',
            'data' => ['transaction_id' => 'txn_paddle_1', 'action' => 'chargeback'],
        ]);
        $this->assertSame('opened', $opened);
        $this->assertSame('disputed', $this->settlement($order)->status);

        $reversed = app(ChargebackEventHandler::class)->handle([
            'event_type' => 'adjustment.updated',
            'data' => ['transaction_id' => 'txn_paddle_1', 'action' => 'chargeback_reverse'],
        ]);
        // The sale had not been released yet, so the won dispute returns it to pending for the next release run.
        $this->assertSame('reversed', $reversed);
        $this->assertSame('pending', $this->settlement($order)->status);
    }

    public function test_an_unrelated_event_is_ignored(): void
    {
        $this->settledSale('pi_other');

        $this->assertNull(app(ChargebackEventHandler::class)->handle(['type' => 'payment_intent.succeeded', 'data' => ['object' => ['payment_intent' => 'pi_other']]]));
    }

    public function test_paypal_dispute_resolved_for_the_seller_reverses_the_chargeback(): void
    {
        $order = $this->settledSale('txn_pp_resolved_1');
        app(ChargebackEventHandler::class)->handle([
            'event_type' => 'CUSTOMER.DISPUTE.CREATED',
            'resource' => ['disputed_transactions' => [['seller_transaction_id' => 'txn_pp_resolved_1']]],
        ]);

        $handled = app(ChargebackEventHandler::class)->handle([
            'event_type' => 'CUSTOMER.DISPUTE.RESOLVED',
            'resource' => [
                'dispute_outcome' => ['outcome_code' => 'RESOLVED_SELLER_FAVOUR'],
                'disputed_transactions' => [['seller_transaction_id' => 'txn_pp_resolved_1']],
            ],
        ]);

        $this->assertSame('reversed', $handled);
        $this->assertSame('pending', $this->settlement($order)->status);
    }

    public function test_paypal_dispute_resolved_for_the_buyer_keeps_the_hold(): void
    {
        $order = $this->settledSale('txn_pp_resolved_2');
        app(ChargebackEventHandler::class)->handle([
            'event_type' => 'CUSTOMER.DISPUTE.CREATED',
            'resource' => ['disputed_transactions' => [['seller_transaction_id' => 'txn_pp_resolved_2']]],
        ]);

        $handled = app(ChargebackEventHandler::class)->handle([
            'event_type' => 'CUSTOMER.DISPUTE.RESOLVED',
            'resource' => [
                'dispute_outcome' => ['outcome_code' => 'RESOLVED_BUYER_FAVOUR'],
                'disputed_transactions' => [['seller_transaction_id' => 'txn_pp_resolved_2']],
            ],
        ]);

        $this->assertNull($handled);
        $this->assertSame('disputed', $this->settlement($order)->status);
    }
}
