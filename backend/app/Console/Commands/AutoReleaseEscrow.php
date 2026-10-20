<?php

namespace App\Console\Commands;

use App\Services\Escrow\EscrowTimingService;
use Illuminate\Console\Command;

/**
 * Runs the escrow timing pass: releases due funds, holds escrows with no delivery,
 * and sends the 24-hour release reminders. It never refunds automatically.
 */
class AutoReleaseEscrow extends Command
{
    protected $signature = 'escrow:auto-release';

    protected $description = 'Release due escrow funds, hold undelivered escrows, and send release reminders';

    public function handle(EscrowTimingService $timing): int
    {
        $counts = $timing->processDue();

        // Digital sales whose 48-hour window has closed with no open dispute are released too.
        $digitalReleased = app(\App\Services\Wallet\DigitalSaleService::class)->releaseDue();
        $this->info("Digital sales released: {$digitalReleased}.");

        $this->info(sprintf(
            'Released %d, held %d (no delivery), reminded %d, failed %d.',
            $counts['released'],
            $counts['held_no_delivery'],
            $counts['reminded'],
            $counts['failed'],
        ));

        return self::SUCCESS;
    }
}
