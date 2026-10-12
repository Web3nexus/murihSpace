<?php

namespace App\Console\Commands;

use App\Models\User;
use App\Services\Wallet\LedgerService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class ProcessVerificationBadges extends Command
{
    protected $signature = 'verification-badges:process';

    protected $description = 'Expire verification badges and process auto-renewals';

    public function handle(LedgerService $ledgerService): int
    {
        $fee = (int) \App\Models\AdminSetting::get('verification_badge_fee', config('murihspace.verification_badge_fee', 100));
        $expired = 0;
        $renewed = 0;

        User::where('verification_badge_status', 'active')
            ->where('verification_badge_expires_at', '<', now())
            ->chunk(100, function ($users) use (&$expired, &$renewed, $fee, $ledgerService) {
                foreach ($users as $user) {
                    DB::transaction(function () use ($user, &$expired, &$renewed, $fee, $ledgerService) {
                        $wallet = $user->wallet;

                        if ($user->verification_badge_auto_renew && $wallet && $wallet->balance >= $fee) {
                            $ledgerService->debit(
                                $user->id,
                                $fee,
                                'MSH',
                                'verification_badge_renewal',
                                'Verified badge auto-renewal (1 month)',
                                ['badge' => true, 'auto_renew' => true],
                            );

                            $user->update([
                                'verification_badge_expires_at' => now()->addMonth(),
                                'verification_badge_status' => 'active',
                                'is_premium' => true,
                            ]);
                            $renewed++;
                            return;
                        }

                        $user->update([
                            'verification_badge_status' => 'expired',
                            'is_premium' => false,
                        ]);
                        $expired++;
                    });
                }
            });

        $this->info("Processed badges. Expired: {$expired}, Auto-renewed: {$renewed}.");

        return self::SUCCESS;
    }
}
