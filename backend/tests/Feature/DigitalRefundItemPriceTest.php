<?php

namespace Tests\Feature;

use App\Models\DigitalProduct;
use App\Models\Order;
use App\Models\Payment;
use App\Models\User;
use App\Enums\PaymentStatus;
use App\Services\Payment\Exceptions\PaymentException;
use App\Enums\RefundStatus;
use App\Models\Refund;
use App\Services\Payment\RefundService;
use App\Services\Wallet\WalletService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DigitalRefundItemPriceTest extends TestCase
{
    use RefreshDatabase;

    /** A paid digital order: $100 item, $5 buyer fee, $105 charged. */
    private function paidDigitalOrder(): array
    {
        $creator = User::factory()->create(['role' => 'creator', 'kyc_status' => 'verified']);
        (new WalletService())->getOrCreateWallet($creator, 'creator');
        $buyer = User::factory()->create(['role' => 'member']);
        $product = DigitalProduct::create(['creator_id' => $creator->id, 'title' => 'Pack', 'slug' => 'pack-'.uniqid(), 'price' => 100]);

        $reference = 'pi_'.uniqid();
        $order = Order::create([
            'order_number' => 'ORD-'.uniqid(), 'buyer_id' => $buyer->id, 'creator_id' => $creator->id,
            'product_id' => $product->id, 'idempotency_key' => 'k-'.uniqid(), 'subtotal' => 100, 'platform_fee' => 5,
            'tax' => 0, 'total' => 105, 'currency' => 'USD', 'status' => 'completed', 'paid_at' => now(),
            'payment_intent_id' => $reference,
        ]);

        $payment = Payment::create([
            'provider' => 'paddle', 'user_id' => $buyer->id, 'transaction_type' => 'digital_product',
            'payment_method' => 'card', 'amount' => 10500, 'currency' => 'USD', 'fees' => 0,
            'net_amount' => 10500, 'status' => PaymentStatus::Successful, 'idempotency_key' => 'p-'.uniqid(),
            'provider_transaction_id' => $reference, 'metadata' => [],
        ]);

        return [$order, $payment];
    }

    public function test_the_refundable_share_of_a_digital_sale_is_the_item_price(): void
    {
        [, $payment] = $this->paidDigitalOrder();

        $this->assertSame(10000, app(RefundService::class)->digitalItemShare($payment));
    }

    public function test_a_refund_above_the_item_price_is_refused_before_it_reaches_the_provider(): void
    {
        [, $payment] = $this->paidDigitalOrder();

        $this->expectException(PaymentException::class);
        $this->expectExceptionMessage("limited to the item price (10000 minor units)");

        app(RefundService::class)->issueRefund([
            'payment_id' => $payment->id,
            'amount' => 10500,
            'reason' => 'Buyer requested full refund',
        ]);
    }

    public function test_a_payment_that_is_not_a_digital_sale_has_no_item_cap(): void
    {
        $payment = Payment::create([
            'provider' => 'paddle', 'user_id' => User::factory()->create()->id, 'transaction_type' => 'coin_purchase',
            'payment_method' => 'card', 'amount' => 5000, 'currency' => 'USD', 'fees' => 0,
            'net_amount' => 5000, 'status' => PaymentStatus::Successful, 'idempotency_key' => 'p-'.uniqid(),
            'provider_transaction_id' => 'pi_not_a_digital_order', 'metadata' => [],
        ]);

        $this->assertNull(app(RefundService::class)->digitalItemShare($payment));
    }

    public function test_partial_refunds_cannot_add_up_past_the_item_price(): void
    {
        [, $payment] = $this->paidDigitalOrder();
        Refund::create([
            'payment_id' => $payment->id, 'amount' => 10000, 'currency' => 'USD', 'reason' => 'Item refund',
            'provider' => 'paddle', 'status' => RefundStatus::Successful, 'idempotency_key' => 'r-'.uniqid(),
        ]);

        // 500 is below the item price on its own, but it would refund the buyer's fee on top of the item.
        $this->expectException(PaymentException::class);
        $this->expectExceptionMessage('limited to the item price');

        app(RefundService::class)->issueRefund([
            'payment_id' => $payment->id,
            'amount' => 500,
            'reason' => 'Buyer fee',
        ]);
    }
}
