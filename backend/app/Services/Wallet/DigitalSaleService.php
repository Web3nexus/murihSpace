<?php

namespace App\Services\Wallet;

use App\Models\DigitalSaleSettlement;
use App\Models\DisputeRefund;
use App\Models\Payment;
use App\Models\Order;
use App\Services\Commission\CommissionService;
use App\Models\User;
use App\Services\Payment\LiveExchangeRateService;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

/**
 * Digital sales, with no escrow. The seller's share of a paid order is converted to USD
 * (the universal wallet currency) using the provider's rate, and held in `pending` for 48 hours.
 *
 *  - No dispute by the release time: the amount is released to the seller.
 *  - A buyer dispute, which must be opened within the 48 hours, or a chargeback at any time,
 *    holds the sale. If the seller has already received it, the amount is moved from their
 *    withdrawable balance into `disputed`, so it can be returned if the seller loses.
 */
class DigitalSaleService
{
    public const HOLD_HOURS = 48;

    public function __construct(
        private readonly LiveExchangeRateService $rates,
        private readonly SellerEarningsService $earnings,
    ) {}

    /** Records the seller's share of a paid digital order. Idempotent per order. */
    public function settleOrder(Order $order): ?DigitalSaleSettlement
    {
        if (! $order->creator_id) {
            return null;
        }

        $existing = DigitalSaleSettlement::where('order_id', $order->id)->first();
        if ($existing) {
            return $existing;
        }

        // Seller fee: the admin-set digital rate, applied to the subtotal at settlement time.
        // The buyer fee is the platform_fee added at checkout. Both are recorded.
        $subtotal = (float) $order->subtotal;
        $sellerFeeRate = app(CommissionService::class)->getCommissionPercentage('digital');
        $sellerFee = round($subtotal * $sellerFeeRate / 100, 2);
        $buyerFee = round((float) $order->platform_fee, 2);

        $net = round($subtotal - $sellerFee, 2);
        if ($net <= 0) {
            return null;
        }

        [$usdCents, $rate] = $this->toUsdCents($net, (string) $order->currency);
        [$sellerFeeUsd] = $this->toUsdCents($sellerFee, (string) $order->currency);
        [$buyerFeeUsd] = $this->toUsdCents($buyerFee, (string) $order->currency);
        $paidAt = $order->paid_at ? Carbon::parse($order->paid_at) : now();

        return DB::transaction(function () use ($order, $net, $usdCents, $rate, $paidAt, $sellerFeeRate, $sellerFeeUsd, $buyerFeeUsd) {
            $seller = User::findOrFail($order->creator_id);
            $held = $this->earnings->holdPending(
                seller: $seller,
                usdCents: $usdCents,
                type: 'digital_sale',
                idempotencyKey: "DIGITAL_SALE_{$order->id}",
                metadata: ['order_id' => $order->id, 'order_currency' => $order->currency],
            );

            // Platform revenue for both sides, in the ledger, so the fees are visible in transactions.
            if ($sellerFeeUsd + $buyerFeeUsd > 0) {
                app(LedgerService::class)->creditPlatformRevenue(
                    amount: $sellerFeeUsd + $buyerFeeUsd,
                    currency: 'USD',
                    description: "Digital sale fees for order #{$order->id} (buyer: {$buyerFeeUsd}, seller: {$sellerFeeUsd} USD cents)",
                    idempotencyKey: "DIGITAL_FEES_{$order->id}",
                    metadata: ['order_id' => $order->id, 'buyer_fee_usd' => $buyerFeeUsd, 'seller_fee_usd' => $sellerFeeUsd, 'seller_fee_rate' => $sellerFeeRate],
                );
            }

            return DigitalSaleSettlement::create([
                'order_id' => $order->id,
                'seller_id' => $seller->id,
                'buyer_id' => $order->buyer_id,
                'order_currency' => strtoupper((string) $order->currency),
                'order_net_amount' => $net,
                'fx_rate' => $rate,
                'seller_fee_rate' => $sellerFeeRate,
                'seller_fee_usd' => $sellerFeeUsd,
                'buyer_fee_usd' => $buyerFeeUsd,
                'gross_usd' => $usdCents,
                'credited_usd' => $held['credited'],
                'status' => 'pending',
                'release_at' => $paidAt->copy()->addHours(self::HOLD_HOURS),
            ]);
        });
    }

    /**
     * Releases settlements whose 48-hour window has closed and that have no open dispute.
     *
     * @return int The number of settlements released.
     */
    public function releaseDue(?Carbon $now = null): int
    {
        $now ??= now();
        $released = 0;

        DigitalSaleSettlement::where('status', 'pending')
            ->where('release_at', '<=', $now)
            ->orderBy('id')
            ->chunkById(100, function ($rows) use ($now, &$released) {
                foreach ($rows as $row) {
                    DB::transaction(function () use ($row, $now, &$released) {
                        $locked = DigitalSaleSettlement::whereKey($row->id)->lockForUpdate()->first();
                        if (! $locked || $locked->status !== 'pending' || $locked->release_at->gt($now)) {
                            return;
                        }

                        $this->earnings->releaseHeld(
                            seller: User::findOrFail($locked->seller_id),
                            credited: (int) $locked->credited_usd,
                            type: 'digital_sale',
                            idempotencyKey: "DIGITAL_SALE_{$locked->order_id}_RELEASE",
                        );

                        $locked->update(['status' => 'released', 'released_at' => $now]);
                        $released++;
                    });
                }
            });

        return $released;
    }

    /**
     * Opens a dispute on a digital sale. A buyer dispute must be within the 48-hour window.
     * A chargeback can arrive at any time. Opening a dispute on a settled sale holds the funds.
     */
    public function openDispute(Order $order, string $source, ?Carbon $now = null): ?DigitalSaleSettlement
    {
        $now ??= now();
        $settlement = DigitalSaleSettlement::where('order_id', $order->id)->first();
        if (! $settlement) {
            return null;
        }

        if ($source === 'buyer') {
            $paidAt = $order->paid_at ? Carbon::parse($order->paid_at) : $settlement->created_at;
            if ($now->gt($paidAt->copy()->addHours(self::HOLD_HOURS))) {
                throw new InvalidArgumentException('Digital purchases can be disputed within 48 hours of payment.');
            }
        }

        if ($settlement->status === 'disputed') {
            return $settlement;
        }
        if (! in_array($settlement->status, ['pending', 'released'], true)) {
            throw new InvalidArgumentException("This sale cannot be disputed (status: {$settlement->status}).");
        }

        return DB::transaction(function () use ($settlement, $source, $now) {
            $locked = DigitalSaleSettlement::whereKey($settlement->id)->lockForUpdate()->firstOrFail();
            $seller = User::findOrFail($locked->seller_id);

            $held = 0;
            if ($locked->status === 'released') {
                $held = $this->earnings->holdFromWithdrawable($seller, (int) $locked->credited_usd, "DIGITAL_SALE_{$locked->order_id}_DISPUTE");
            }

            $locked->update([
                'status' => 'disputed',
                'disputed_at' => $now,
                'dispute_source' => $source,
                'held_usd' => $held,
            ]);

            return $locked->fresh();
        });
    }

    /** Staff decision on a disputed sale. `seller_won` returns the funds. `buyer_won` claws them back. */
    public function resolve(DigitalSaleSettlement $settlement, string $outcome, ?Carbon $now = null, bool $providerRefunded = false): DigitalSaleSettlement
    {
        if (! in_array($outcome, ['seller_won', 'buyer_won'], true)) {
            throw new InvalidArgumentException('Outcome must be seller_won or buyer_won.');
        }

        return DB::transaction(function () use ($settlement, $outcome, $now, $providerRefunded) {
            $locked = DigitalSaleSettlement::whereKey($settlement->id)->lockForUpdate()->firstOrFail();
            if ($locked->status !== 'disputed') {
                throw new InvalidArgumentException("Only a disputed sale can be resolved (status: {$locked->status}).");
            }

            $seller = User::findOrFail($locked->seller_id);
            $key = "DIGITAL_SALE_{$locked->order_id}_RESOLVE";
            $credited = (int) $locked->credited_usd;
            $held = (int) $locked->held_usd;
            $now ??= now();

            if ($locked->released_at === null) {
                // Still in the window: the funds sit in pending.
                if ($outcome === 'seller_won') {
                    $locked->update(['status' => 'pending', 'release_at' => $now, 'resolved_at' => $now, 'dispute_outcome' => $outcome]);
                } else {
                    $this->earnings->reversePending($seller, $credited, $key);
                    $this->reverseSellerFee($locked);
                    if (! $providerRefunded) {
                        $this->creditBuyerRefundBalance($locked);
                    }
                    $locked->update(['status' => 'reversed', 'resolved_at' => $now, 'dispute_outcome' => $outcome, 'provider_refund_required' => ! $providerRefunded]);
                }
            } elseif ($outcome === 'seller_won') {
                $this->earnings->returnFromDisputed($seller, $held, $key);
                $locked->update(['status' => 'released', 'resolved_at' => $now, 'dispute_outcome' => $outcome]);
            } else {
                $this->earnings->clawback($seller, $held, max(0, $credited - $held), $key);
                $this->reverseSellerFee($locked);
                if (! $providerRefunded) {
                    $this->creditBuyerRefundBalance($locked);
                }
                $locked->update(['status' => 'reversed', 'resolved_at' => $now, 'dispute_outcome' => $outcome, 'provider_refund_required' => ! $providerRefunded]);
            }

            return $locked->fresh();
        });
    }

    /**
     * A buyer win reverses the seller-side platform fee. The platform keeps nothing from a sale that
     * was refunded. The buyer's own fee is not refunded and stays as platform revenue.
     */
    private function reverseSellerFee(DigitalSaleSettlement $settlement): void
    {
        $sellerFeeUsd = (int) $settlement->seller_fee_usd;
        if ($sellerFeeUsd <= 0) {
            return;
        }

        app(LedgerService::class)->debit(
            user: (int) config('wallet.platform_revenue_user_id', 1),
            amount: $sellerFeeUsd,
            currency: 'USD',
            walletType: 'system',
            balanceCategory: 'available',
            type: 'fee_reversal',
            description: "Seller fee reversed for order #{$settlement->order_id} (dispute won by buyer)",
            idempotencyKey: "DIGITAL_FEE_REVERSAL_{$settlement->order_id}",
        );
    }

    /**
     * Credits the buyer's refund balance for a dispute they won. The refund is the item price only:
     * the buyer's fee is not refunded. The money stays on the platform: it can be spent on purchases
     * or gifts, but not withdrawn, and it can be sent back to the card.
     */
    private function creditBuyerRefundBalance(DigitalSaleSettlement $settlement): void
    {
        $order = Order::findOrFail($settlement->order_id);
        if (DisputeRefund::where('order_id', $order->id)->exists()) {
            return;
        }

        $charged = round((float) $order->subtotal, 2);
        [$usdCents] = $this->toUsdCents($charged, (string) $order->currency);

        DisputeRefund::create([
            'buyer_id' => $order->buyer_id,
            'order_id' => $order->id,
            'settlement_id' => $settlement->id,
            'original_amount' => $charged,
            'original_currency' => strtoupper((string) $order->currency),
            'amount_usd' => $usdCents,
            'status' => 'available',
        ]);

        app(LedgerService::class)->credit(
            user: (int) $order->buyer_id,
            amount: $usdCents,
            currency: 'USD',
            walletType: 'system',
            balanceCategory: 'available',
            type: 'dispute_refund',
            description: "Refund balance for order #{$order->id} (dispute won)",
            idempotencyKey: "DISPUTE_REFUND_{$order->id}",
            metadata: ['order_id' => $order->id, 'original_amount' => $charged, 'original_currency' => $order->currency],
        );
    }

    /** The provider payment behind an order, found by its payment reference. */
    public function paymentForOrder(Order $order): ?Payment
    {
        $references = array_filter([$order->payment_intent_id]);
        if ($references === []) {
            return null;
        }

        return Payment::whereIn('provider_transaction_id', $references)
            ->orWhereIn('provider_reference', $references)
            ->first();
    }

    /**
     * A full refund was issued to the buyer through the provider. The sale is reversed:
     * the seller's share is taken back, and no second refund is requested from the provider.
     */
    public function reverseForRefund(Order $order, ?Carbon $now = null): ?DigitalSaleSettlement
    {
        $settlement = DigitalSaleSettlement::where('order_id', $order->id)->first();
        if (! $settlement || $settlement->status === 'reversed') {
            return $settlement;
        }

        if ($settlement->status !== 'disputed') {
            $settlement = $this->openDispute($order, 'refund', $now);
        }

        return $this->resolve($settlement, 'buyer_won', $now, providerRefunded: true);
    }

    /**
     * Converts a major-unit amount in $currency to USD minor units using the provider rate.
     *
     * @return array{0: int, 1: float} [USD cents, rate used]
     */
    private function toUsdCents(float $amount, string $currency): array
    {
        $currency = strtoupper($currency);
        if ($currency === 'USD') {
            return [(int) round($amount * 100), 1.0];
        }

        $converted = $this->rates->convert($amount, $currency, 'USD', fromMinorUnits: false, toMinorUnits: true);
        if (($converted['rate'] ?? 0) <= 0) {
            throw new InvalidArgumentException("No exchange rate is available for {$currency}.");
        }

        return [(int) $converted['converted_amount'], (float) $converted['rate']];
    }
}
