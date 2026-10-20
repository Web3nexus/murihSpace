<?php

namespace App\Services\Payment;

use App\Models\DigitalSaleSettlement;
use App\Models\Order;
use App\Services\Wallet\DigitalSaleService;

/**
 * Turns a provider's chargeback or dispute webhook into a dispute on the digital sale it belongs to.
 *
 * Event names, per provider:
 *  - Stripe: `charge.dispute.created` opens a dispute. `charge.dispute.closed` with status `won` reverses it.
 *  - PayPal: `CUSTOMER.DISPUTE.CREATED` (lower-cased here) opens a dispute. `CUSTOMER.DISPUTE.RESOLVED` with
 *    outcome `RESOLVED_SELLER_FAVOUR` reverses it. A buyer outcome leaves the hold in place.
 *  - Paystack: `charge.dispute.create` opens a dispute. `charge.dispute.remind` and `charge.dispute.resolve`
 *    are informational here, because the outcome comes from the Paystack dashboard.
 *  - Paddle: `adjustment.created` with action or type `chargeback` or `chargeback_warning` opens a dispute,
 *    and `chargeback_reverse` reverses it.
 *
 * Only a dispute that came from a chargeback is reversed here. A buyer dispute is decided by staff.
 */
class ChargebackEventHandler
{
    private const OPEN_EVENTS = ['charge.dispute.created', 'charge.dispute.create', 'customer.dispute.created', 'payment.dispute.created'];
    private const PADDLE_OPEN = ['chargeback', 'chargeback_warning'];
    private const PADDLE_REVERSE = ['chargeback_reverse'];

    public function __construct(private readonly DigitalSaleService $sales) {}

    /** Handles one webhook payload. Returns what was done, or null when the event is not about a dispute. */
    public function handle(array $payload): ?string
    {
        [$action, $references] = $this->classify($payload);
        if ($action === null) {
            return null;
        }

        $order = $this->orderFor($references);
        if (! $order) {
            return null;
        }

        if ($action === 'open') {
            $this->sales->openDispute($order, 'chargeback');

            return 'opened';
        }

        $settlement = DigitalSaleSettlement::where('order_id', $order->id)->first();
        if ($settlement && $settlement->status === 'disputed' && $settlement->dispute_source === 'chargeback') {
            $this->sales->resolve($settlement, 'seller_won');

            return 'reversed';
        }

        return null;
    }

    /** @return array{0: ?string, 1: array<int, string>} */
    private function classify(array $payload): array
    {
        // Stripe uses `type`, Paddle `event_type`, Paystack `event`.
        $type = strtolower((string) ($payload['event_type'] ?? $payload['event'] ?? $payload['type'] ?? ''));
        $data = is_array($payload['data'] ?? null) ? $payload['data'] : [];

        if (in_array($type, ['adjustment.created', 'adjustment.updated'], true)) {
            $kind = strtolower((string) ($data['action'] ?? $data['type'] ?? ''));
            $refs = [(string) ($data['transaction_id'] ?? '')];
            if (in_array($kind, self::PADDLE_OPEN, true)) {
                return ['open', $refs];
            }
            if (in_array($kind, self::PADDLE_REVERSE, true)) {
                return ['reverse', $refs];
            }

            return [null, []];
        }

        if ($type === 'customer.dispute.resolved') {
            $resource = is_array($payload['resource'] ?? null) ? $payload['resource'] : [];
            $outcome = strtoupper((string) ($resource['dispute_outcome']['outcome_code'] ?? ''));
            if ($outcome !== 'RESOLVED_SELLER_FAVOUR') {
                return [null, []];
            }

            return ['reverse', [(string) ($resource['disputed_transactions'][0]['seller_transaction_id'] ?? '')]];
        }

        if ($type === 'charge.dispute.closed') {
            $object = is_array($data['object'] ?? null) ? $data['object'] : [];
            if (strtolower((string) ($object['status'] ?? '')) === 'won') {
                return ['reverse', $this->stripeReferences($object)];
            }

            return [null, []];
        }

        if (in_array($type, self::OPEN_EVENTS, true)) {
            $object = is_array($data['object'] ?? null) ? $data['object'] : [];
            $refs = array_merge(
                $this->stripeReferences($object),
                [(string) ($data['reference'] ?? ''), (string) ($data['transaction']['reference'] ?? '')],
                [(string) ($payload['resource']['disputed_transactions'][0]['seller_transaction_id'] ?? '')],
            );

            return ['open', $refs];
        }

        return [null, []];
    }

    /** @return array<int, string> */
    private function stripeReferences(array $object): array
    {
        return [(string) ($object['payment_intent'] ?? ''), (string) ($object['id'] ?? '')];
    }

    /** @param array<int, string> $references */
    private function orderFor(array $references): ?Order
    {
        $references = array_values(array_filter(array_unique($references), fn ($r) => $r !== ''));
        if ($references === []) {
            return null;
        }

        return Order::whereIn('payment_intent_id', $references)->first();
    }
}
