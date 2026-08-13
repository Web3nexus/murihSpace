<?php

namespace App\Services\Billing;

use App\Models\AdWallet;
use App\Models\AdLedgerTransaction;
use Illuminate\Support\Facades\DB;
use Exception;

class LedgerService
{
    /**
     * Add funds to the wallet (credit).
     */
    public function addFunds(AdWallet $wallet, int $amount, string $description = 'Fund Deposit'): AdLedgerTransaction
    {
        if ($amount <= 0) {
            throw new Exception("Amount must be positive.");
        }

        return DB::transaction(function () use ($wallet, $amount, $description) {
            $wallet = AdWallet::lockForUpdate()->findOrFail($wallet->id);
            $wallet->available_balance += $amount;
            $wallet->save();

            return AdLedgerTransaction::create([
                'ad_wallet_id' => $wallet->id,
                'amount' => $amount,
                'type' => 'credit',
                'description' => $description,
            ]);
        });
    }

    /**
     * Reserve funds for upcoming ad delivery.
     * Moves funds from available to reserved.
     */
    public function reserveFunds(AdWallet $wallet, int $amount, string $referenceType, int $referenceId): AdLedgerTransaction
    {
        if ($amount <= 0) {
            throw new Exception("Amount must be positive.");
        }

        return DB::transaction(function () use ($wallet, $amount, $referenceType, $referenceId) {
            // Re-fetch with lock for update
            $wallet = AdWallet::lockForUpdate()->find($wallet->id);

            if ($wallet->available_balance < $amount) {
                throw new Exception("Insufficient available balance.");
            }

            $wallet->available_balance -= $amount;
            $wallet->reserved_balance += $amount;
            $wallet->save();

            return AdLedgerTransaction::create([
                'ad_wallet_id' => $wallet->id,
                'amount' => $amount, // Positive for reserve log
                'type' => 'reserve',
                'reference_type' => $referenceType,
                'reference_id' => $referenceId,
                'description' => "Reserved for {$referenceType} #{$referenceId}",
            ]);
        });
    }

    /**
     * Charge funds that were previously reserved.
     * Decreases reserved balance and increases lifetime spend.
     */
    public function chargeReservedFunds(AdWallet $wallet, int $amount, string $referenceType, int $referenceId): AdLedgerTransaction
    {
        if ($amount <= 0) {
            throw new Exception("Amount must be positive.");
        }

        return DB::transaction(function () use ($wallet, $amount, $referenceType, $referenceId) {
            $wallet = AdWallet::lockForUpdate()->find($wallet->id);

            if ($wallet->reserved_balance < $amount) {
                throw new Exception("Insufficient reserved balance for this charge.");
            }

            $wallet->reserved_balance -= $amount;
            $wallet->lifetime_spend += $amount;
            $wallet->save();

            return AdLedgerTransaction::create([
                'ad_wallet_id' => $wallet->id,
                'amount' => -$amount, // Negative to represent debit
                'type' => 'debit',
                'reference_type' => $referenceType,
                'reference_id' => $referenceId,
                'description' => "Charged for {$referenceType} #{$referenceId}",
            ]);
        });
    }
}
