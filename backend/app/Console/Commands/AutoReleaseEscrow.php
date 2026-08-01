<?php

namespace App\Console\Commands;

use App\Models\Escrow;
use App\Services\Wallet\LedgerService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class AutoReleaseEscrow extends Command
{
    protected $signature = 'escrow:auto-release';
    protected $description = 'Auto-release escrow funds after delivery confirmation window';

    public function handle(LedgerService $ledgerService): int
    {
        $this->info('Checking escrows for auto-release...');

        $released = 0;
        $refunded = 0;

        Escrow::where('status', 'held')
            ->chunk(100, function ($escrows) use ($ledgerService, &$released, &$refunded) {
                foreach ($escrows as $escrow) {
                    $autoDate = $escrow->autoReleaseDate();
                    if (! $autoDate || $autoDate->isFuture()) {
                        continue;
                    }

                    DB::transaction(function () use ($escrow, $ledgerService, &$released, &$refunded) {
                        $order = $escrow->order;

                        $deliveryConfirmed = $order && $order->status === 'delivered';

                        if ($deliveryConfirmed) {
                            $txn = $ledgerService->credit(
                                $escrow->seller_id,
                                $escrow->amount,
                                $escrow->currency,
                                'escrow_auto_release',
                                "Auto-release for order #{$escrow->order_id}",
                                ['escrow_id' => $escrow->id],
                            );

                            $escrow->update([
                                'status' => 'released',
                                'released_at' => now(),
                                'ledger_transaction_id' => $txn->id,
                            ]);
                            $released++;
                        } else {
                            $txn = $ledgerService->credit(
                                $escrow->buyer_id,
                                $escrow->amount,
                                $escrow->currency,
                                'escrow_auto_refund',
                                "Auto-refund for undelivered order #{$escrow->order_id}",
                                ['escrow_id' => $escrow->id],
                            );

                            $escrow->update([
                                'status' => 'refunded',
                                'ledger_transaction_id' => $txn->id,
                            ]);
                            $refunded++;
                        }
                    });
                }
            });

        $this->info("Auto-release complete. Released: {$released}, Refunded: {$refunded}.");
        return Command::SUCCESS;
    }
}
