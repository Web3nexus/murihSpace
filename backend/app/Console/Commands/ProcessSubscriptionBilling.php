<?php

namespace App\Console\Commands;

use App\Models\Subscription;
use App\Models\Wallet;
use App\Notifications\SubscriptionExpired;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class ProcessSubscriptionBilling extends Command
{
    protected $signature = 'billing:process-recurring';
    protected $description = 'Process recurring subscription billing';

    public function handle(): int
    {
        $this->info('Starting recurring billing...');

        $processed = 0;
        $expired = 0;

        Subscription::where('status', 'active')
            ->where('current_period_end', '<', now())
            ->chunk(100, function ($subscriptions) use (&$processed, &$expired) {
                foreach ($subscriptions as $sub) {
                    DB::transaction(function () use ($sub, &$processed, &$expired) {
                        $plan = $sub->plan;
                        if (! $plan) {
                            $sub->update(['status' => 'expired']);
                            $expired++;
                            return;
                        }

                        $wallet = Wallet::where('user_id', $sub->subscriber_id)->first();

                        if ($wallet && $wallet->balance >= $plan->price) {
                            $wallet->decrement('balance', $plan->price);

                            $periodStart = now();
                            $periodEnd = $plan->billing_cycle === 'yearly'
                                ? $periodStart->copy()->addYear()
                                : $periodStart->copy()->addMonth();

                            $sub->update([
                                'current_period_start' => $periodStart,
                                'current_period_end' => $periodEnd,
                                'status' => 'active',
                            ]);
                            $processed++;
                        } else {
                            $attempts = (int) $sub->past_due_attempts ?? 0;
                            if ($attempts >= 3) {
                                $sub->update(['status' => 'expired']);
                                $expired++;
                            } else {
                                $sub->update([
                                    'status' => 'past_due',
                                    'past_due_attempts' => $attempts + 1,
                                ]);
                            }
                        }
                    });
                }
            });

        $this->info("Billing complete. Renewed: {$processed}, Expired: {$expired}.");
        return Command::SUCCESS;
    }
}
