<?php

namespace App\Console\Commands;

use App\Enums\RefundStatus;
use App\Models\AuditLog;
use App\Models\Refund;
use App\Models\WalletHold;
use App\Services\AdminAlertService;
use App\Services\Payment\Contracts\RefundStatusProviderInterface;
use App\Services\Payment\RefundService;
use App\Services\Payment\Router\ProviderRouter;
use App\Services\Wallet\DisputeRefundSettlementService;
use Illuminate\Console\Command;
use Throwable;

class ReconcilePendingRefunds extends Command
{
    protected $signature = 'refunds:reconcile-pending {--hours=24 : Hours a dispute refund may stay pending before it is checked}';

    protected $description = 'Settle dispute refunds that are still pending at the provider after a set age';

    public function handle(RefundService $refunds, ProviderRouter $router): int
    {
        $cutoff = now()->subHours((int) $this->option('hours'));

        $holds = WalletHold::where('reference_type', 'dispute_refund')
            ->where('status', 'active')
            ->where('created_at', '<=', $cutoff)
            ->get();

        $settled = 0;
        $escalated = 0;

        foreach ($holds as $hold) {
            $disputeId = (int) $hold->reference_id;

            // LIKE treats "_" as a wildcard, so the exact dispute id is checked in PHP.
            $refund = Refund::where('idempotency_key', 'like', "DISPUTE_CARD_REFUND_{$disputeId}%")
                ->get()
                ->filter(fn (Refund $r) => DisputeRefundSettlementService::disputeIdFromKey($r->idempotency_key) === $disputeId)
                ->sortByDesc('id')
                ->first();

            if (! $refund) {
                $escalated += $this->escalate($hold, null, 'No provider refund is recorded for this held dispute refund.') ? 1 : 0;

                continue;
            }

            // Final at the provider but not settled here: the settlement is re-run (it is idempotent).
            if (in_array($refund->status, [RefundStatus::Successful, RefundStatus::Failed], true)) {
                $refunds->applyProviderResult($refund, $refund->status, $refund->failure_reason);
                $settled++;

                continue;
            }

            $remote = $this->lookup($router, $refund);
            if ($remote === null) {
                $escalated += $this->escalate($hold, $refund, 'The provider could not confirm this refund. Review it at the provider.') ? 1 : 0;

                continue;
            }

            $refunds->applyProviderResult(
                $refund,
                $remote,
                $remote === RefundStatus::Failed ? 'Declined by the provider on reconciliation.' : null,
            );
            $settled++;
        }

        $this->info("Checked {$holds->count()} held dispute refund(s): settled {$settled}, escalated {$escalated}.");

        return self::SUCCESS;
    }

    private function lookup(ProviderRouter $router, Refund $refund): ?RefundStatus
    {
        if (! $refund->provider_refund_id) {
            return null;
        }

        try {
            $provider = $router->getProvider($refund->provider);
        } catch (Throwable) {
            return null;
        }

        if (! $provider instanceof RefundStatusProviderInterface) {
            return null;
        }

        $status = $provider->verifyRefund($refund->provider_refund_id);

        return in_array($status, [RefundStatus::Successful, RefundStatus::Failed], true) ? $status : null;
    }

    /** Alerts operators once per held refund. Returns false when it was already escalated. */
    private function escalate(WalletHold $hold, ?Refund $refund, string $message): bool
    {
        $already = AuditLog::where('action', 'refund.reconcile_escalated')
            ->where('resource_type', 'wallet_hold')
            ->where('resource_id', (string) $hold->id)
            ->exists();
        if ($already) {
            return false;
        }

        AuditLog::create([
            'user_id' => null,
            'action' => 'refund.reconcile_escalated',
            'resource_type' => 'wallet_hold',
            'resource_id' => (string) $hold->id,
            'metadata' => ['refund_id' => $refund?->id, 'message' => $message],
        ]);

        try {
            app(AdminAlertService::class)->dispatch([
                'event_type' => 'dispute_refund_pending',
                'severity' => 'warning',
                'title' => "Dispute refund still pending (hold #{$hold->id})",
                'description' => $message,
                'reference' => "wallet_hold:{$hold->id}",
                'affected_service' => 'disputes',
                'metadata' => ['hold_id' => $hold->id, 'refund_id' => $refund?->id],
            ]);
        } catch (Throwable $e) {
            report($e);
        }

        return true;
    }
}
