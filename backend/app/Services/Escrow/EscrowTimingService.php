<?php

namespace App\Services\Escrow;

use App\Models\AuditLog;
use App\Models\Escrow;
use App\Models\Message;
use App\Models\User;
use App\Notifications\EscrowTimingNotification;
use App\Services\AdminAlertService;
use App\Services\Payment\Exceptions\PaymentException;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use InvalidArgumentException;

/**
 * Release timing for escrowed funds.
 *
 *  - Digital: funds release 48 hours after delivery. A dispute has to be opened in
 *    that window.
 *  - Physical: the buyer confirms receipt within 3 days of delivery, and funds release
 *    7 days after that confirmation. Without confirmation, funds release 10 days after
 *    delivery (the 3-day confirmation window plus the normal 7-day pending period).
 *  - No delivery by the check date (14 days): the escrow moves to `on_hold`. It is
 *    never refunded automatically.
 *  - A delivery recorded while an escrow is on hold never releases it. It raises a
 *    critical alert so staff can confirm whether the delivery is genuine.
 *
 * Notices go to both parties only when a delivery has been recorded.
 */
class EscrowTimingService
{
    public const DIGITAL_RELEASE_HOURS = 48;
    public const PHYSICAL_RELEASE_DAYS_AFTER_RECEIPT = 7;
    public const PHYSICAL_CONFIRMATION_WINDOW_DAYS = 3;
    public const PHYSICAL_RELEASE_DAYS_WITHOUT_RECEIPT = 10;
    public const NO_DELIVERY_CHECK_DAYS = 14;
    public const REMINDER_HOURS_BEFORE_RELEASE = 24;

    public function __construct(
        private readonly EscrowService $escrows,
        private readonly AdminAlertService $alerts,
    ) {}

    /** The date the escrow would release, given what has been recorded so far. */
    public function computeReleaseAt(Escrow $escrow): Carbon
    {
        $created = $escrow->created_at ? Carbon::parse($escrow->created_at) : now();

        if (! $escrow->delivered_at) {
            return $created->copy()->addDays(self::NO_DELIVERY_CHECK_DAYS);
        }

        $delivered = Carbon::parse($escrow->delivered_at);

        if ($escrow->delivery_kind === 'digital') {
            return $delivered->copy()->addHours(self::DIGITAL_RELEASE_HOURS);
        }

        if ($escrow->buyer_confirmed_at) {
            $confirmed = Carbon::parse($escrow->buyer_confirmed_at);
            $withinWindow = $confirmed->lte($delivered->copy()->addDays(self::PHYSICAL_CONFIRMATION_WINDOW_DAYS));
            if ($withinWindow) {
                return $confirmed->copy()->addDays(self::PHYSICAL_RELEASE_DAYS_AFTER_RECEIPT);
            }
        }

        return $delivered->copy()->addDays(self::PHYSICAL_RELEASE_DAYS_WITHOUT_RECEIPT);
    }

    /** Records a delivery. Starts the release clock, or raises an alert if the escrow is on hold. */
    public function recordDelivery(Escrow $escrow, string $kind, ?Carbon $at = null): void
    {
        if (! in_array($kind, ['digital', 'physical'], true)) {
            throw new InvalidArgumentException("Unknown delivery kind [{$kind}].");
        }

        $at ??= now();

        $escrow->delivery_kind = $kind;
        $escrow->delivered_at ??= $at;
        $escrow->release_at = $this->computeReleaseAt($escrow);
        $escrow->save();

        if ($escrow->status === 'on_hold') {
            // A delivery after a hold never releases the funds on its own.
            $escrow->forceFill(['delivery_alert_at' => now()])->save();
            $this->alerts->dispatch([
                'event_type' => 'escrow_delivery_after_hold',
                'severity' => 'critical',
                'title' => "Delivery recorded on held escrow #{$escrow->id}",
                'description' => 'A delivery was recorded after this escrow was put on hold. The funds were not released. Staff must confirm the delivery is genuine before anything else happens.',
                'reference' => "escrow:{$escrow->id}",
                'affected_service' => 'escrow',
                'metadata' => [
                    'escrow_id' => $escrow->id,
                    'buyer_id' => $escrow->buyer_id,
                    'seller_id' => $escrow->seller_id,
                    'hold_reason' => $escrow->hold_reason,
                    'delivery_kind' => $kind,
                ],
            ]);

            return;
        }

        $this->notifyBuyer($escrow, 'delivered', $kind === 'physical'
            ? 'Your order has been delivered. Please confirm receipt within 3 days.'
            : 'Your digital purchase has been delivered. Funds release in 48 hours unless you open a dispute.');
    }

    /** Buyer confirms a physical delivery. Starts the 7-day release clock from now. */
    public function recordBuyerReceipt(Escrow $escrow, User $buyer, ?Carbon $at = null): void
    {
        if ((int) $escrow->buyer_id !== (int) $buyer->id) {
            throw new InvalidArgumentException('Only the buyer can confirm receipt.');
        }
        if ($escrow->delivery_kind !== 'physical' || ! $escrow->delivered_at) {
            throw new InvalidArgumentException('Receipt can only be confirmed for a delivered physical order.');
        }
        if ($escrow->buyer_confirmed_at) {
            return;
        }

        $escrow->buyer_confirmed_at = $at ?? now();
        $escrow->release_at = $this->computeReleaseAt($escrow);
        $escrow->save();
    }

    /**
     * Buyer releases the funds now, from a held or on-hold escrow. Only the buyer can
     * do this, and only when no dispute is active.
     */
    public function releaseNow(Escrow $escrow, User $buyer): void
    {
        if ((int) $escrow->buyer_id !== (int) $buyer->id) {
            throw new InvalidArgumentException('Only the buyer can release these funds.');
        }

        DB::transaction(function () use ($escrow, $buyer) {
            $locked = Escrow::whereKey($escrow->id)->lockForUpdate()->firstOrFail();
            if (! in_array($locked->status, ['held', 'on_hold'], true)) {
                throw new InvalidArgumentException("Escrow #{$locked->id} cannot be released (current: {$locked->status}).");
            }
            // A staff hold (fraud review, collusion) can only be lifted by staff.
            if ($locked->status === 'on_hold' && $locked->hold_reason !== 'no_delivery') {
                throw new InvalidArgumentException('A staff hold can only be lifted by staff.');
            }

            if ($locked->status === 'on_hold') {
                AuditLog::create([
                    'user_id' => $buyer->id,
                    'action' => 'escrow.release_from_hold',
                    'resource_type' => 'escrow',
                    'resource_id' => (string) $locked->id,
                    'metadata' => ['hold_reason' => $locked->hold_reason],
                ]);
            }

            $locked->update(['status' => 'held', 'held_at' => null, 'hold_reason' => null]);
            $this->escrows->release($locked, null, 'Released by buyer');
        });
    }

    /** Staff hold on one transaction. Recorded in the audit log, with no second approval. */
    public function holdManually(Escrow $escrow, User $actor, string $reason): void
    {
        if ($escrow->status !== 'held') {
            throw new InvalidArgumentException("Only held escrows can be put on hold (current: {$escrow->status}).");
        }

        $escrow->update([
            'status' => 'on_hold',
            'held_at' => now(),
            'hold_reason' => 'manual: '.Str::limit($reason, 150),
        ]);

        AuditLog::create([
            'user_id' => $actor->id,
            'action' => 'escrow.hold',
            'resource_type' => 'escrow',
            'resource_id' => (string) $escrow->id,
            'metadata' => ['reason' => Str::limit($reason, 500)],
        ]);

        if ($escrow->delivered_at) {
            $this->notifyBoth($escrow, 'hold_placed', 'The funds for this order are on hold while the order is reviewed.');
        }
    }

    /** Staff lifts a hold. The escrow goes back to held and the normal timing applies. */
    public function releaseHold(Escrow $escrow, User $actor, string $reason): void
    {
        if ($escrow->status !== 'on_hold') {
            throw new InvalidArgumentException("Only escrows on hold can be released from hold (current: {$escrow->status}).");
        }

        $escrow->update(['status' => 'held', 'held_at' => null, 'hold_reason' => null]);

        AuditLog::create([
            'user_id' => $actor->id,
            'action' => 'escrow.unhold',
            'resource_type' => 'escrow',
            'resource_id' => (string) $escrow->id,
            'metadata' => ['reason' => Str::limit($reason, 500)],
        ]);
    }

    /**
     * The scheduled pass. Returns counts for the log.
     *
     * @return array{held_no_delivery: int, released: int, reminded: int, failed: int}
     */
    public function processDue(?Carbon $now = null): array
    {
        $now ??= now();
        $counts = ['held_no_delivery' => 0, 'released' => 0, 'reminded' => 0, 'failed' => 0];

        Escrow::where('status', 'held')
            ->whereNotNull('release_at')
            ->where('release_at', '<=', $now)
            ->orderBy('id')
            ->chunkById(100, function ($escrows) use ($now, &$counts) {
                foreach ($escrows as $candidate) {
                    $this->processOne($candidate->id, $now, $counts);
                }
            });

        Escrow::where('status', 'held')
            ->whereNull('reminder_sent_at')
            ->whereNotNull('release_at')
            ->where('release_at', '>', $now)
            ->where('release_at', '<=', $now->copy()->addHours(self::REMINDER_HOURS_BEFORE_RELEASE))
            ->orderBy('id')
            ->chunkById(100, function ($escrows) use (&$counts) {
                foreach ($escrows as $escrow) {
                    if ($escrow->delivery_kind === 'physical' && $escrow->buyer_confirmed_at) {
                        continue;
                    }
                    $this->notifyBuyer($escrow, 'release_soon', 'Your funds release in 24 hours unless you confirm or open a dispute.');
                    $escrow->forceFill(['reminder_sent_at' => $now])->save();
                    $counts['reminded']++;
                }
            });

        return $counts;
    }

    /** @param array{held_no_delivery: int, released: int, reminded: int, failed: int} $counts */
    private function processOne(int $escrowId, Carbon $now, array &$counts): void
    {
        DB::transaction(function () use ($escrowId, $now, &$counts) {
            $escrow = Escrow::whereKey($escrowId)->lockForUpdate()->first();

            // Re-check under the lock: a dispute, a release or a hold may have landed first.
            if (! $escrow || $escrow->status !== 'held' || ! $escrow->release_at || $escrow->release_at->gt($now)) {
                return;
            }

            if (! $escrow->delivered_at) {
                // No delivery by the check date. If the two parties have been talking, the
                // escrow is not frozen: the check is pushed out and run again later.
                if ($this->hasTwoWayContact($escrow)) {
                    $escrow->update(['release_at' => $now->copy()->addDays(self::NO_DELIVERY_CHECK_DAYS)]);

                    return;
                }

                // Freeze it. No notice, because no delivery was sent.
                $escrow->update([
                    'status' => 'on_hold',
                    'held_at' => $now,
                    'hold_reason' => 'no_delivery',
                ]);
                $counts['held_no_delivery']++;

                return;
            }

            try {
                $this->escrows->release($escrow, null, 'Automatic release after the delivery window');
                $counts['released']++;
            } catch (PaymentException $e) {
                report($e);
                $counts['failed']++;
            }
        });
    }

    /**
     * True when buyer and seller have each sent a message in their direct conversation
     * since the escrow was created.
     */
    public function hasTwoWayContact(Escrow $escrow): bool
    {
        $conversationIds = DB::table('conversation_participants as buyer')
            ->join('conversation_participants as seller', 'seller.conversation_id', '=', 'buyer.conversation_id')
            ->where('buyer.user_id', $escrow->buyer_id)
            ->where('seller.user_id', $escrow->seller_id)
            ->pluck('buyer.conversation_id');

        if ($conversationIds->isEmpty()) {
            return false;
        }

        $since = $escrow->created_at ? Carbon::parse($escrow->created_at) : now()->subYears(10);
        $sentBy = fn (int $userId) => Message::whereIn('conversation_id', $conversationIds)
            ->where('user_id', $userId)
            ->where('created_at', '>=', $since)
            ->exists();

        return $sentBy((int) $escrow->buyer_id) && $sentBy((int) $escrow->seller_id);
    }

    /**
     * Either party presses "continue" on an automatic no-delivery hold. The escrow goes
     * back to active and the check restarts. A staff hold can't be lifted this way.
     */
    public function resume(Escrow $escrow, User $actor): void
    {
        $isParty = in_array((int) $actor->id, [(int) $escrow->buyer_id, (int) $escrow->seller_id], true);
        if (! $isParty) {
            throw new InvalidArgumentException('Only the buyer or seller can continue this order.');
        }
        if ($escrow->status !== 'on_hold' || $escrow->hold_reason !== 'no_delivery') {
            throw new InvalidArgumentException('Only an automatic no-delivery hold can be continued by the parties.');
        }

        $escrow->update([
            'status' => 'held',
            'held_at' => null,
            'hold_reason' => null,
            'release_at' => now()->addDays(self::NO_DELIVERY_CHECK_DAYS),
        ]);

        AuditLog::create([
            'user_id' => $actor->id,
            'action' => 'escrow.resume',
            'resource_type' => 'escrow',
            'resource_id' => (string) $escrow->id,
            'metadata' => [],
        ]);
    }

    private function notifyBuyer(Escrow $escrow, string $kind, string $message): void
    {
        $buyer = User::find($escrow->buyer_id);
        $buyer?->notify(new EscrowTimingNotification($kind, $escrow->id, $message, $escrow->release_at?->toIso8601String()));
    }

    private function notifyBoth(Escrow $escrow, string $kind, string $message): void
    {
        foreach (array_unique([$escrow->buyer_id, $escrow->seller_id]) as $userId) {
            $user = User::find($userId);
            $user?->notify(new EscrowTimingNotification($kind, $escrow->id, $message, $escrow->release_at?->toIso8601String()));
        }
    }
}
