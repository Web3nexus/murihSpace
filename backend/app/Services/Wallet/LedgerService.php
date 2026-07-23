<?php

namespace App\Services\Wallet;

use App\Models\LedgerEntry;
use App\Models\LedgerTransaction;
use App\Models\User;
use App\Models\Wallet;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class LedgerService
{
    public function __construct(
        private int $platformRevenueUserId = 1,
    ) {}

    public function credit(int $userId, int $amount, string $currency, string $type, ?string $description = null, array $metadata = []): LedgerTransaction
    {
        return $this->execute($userId, $amount, $currency, 'credit', $type, $description, $metadata);
    }

    public function debit(int $userId, int $amount, string $currency, string $type, ?string $description = null, array $metadata = []): LedgerTransaction
    {
        return $this->execute($userId, $amount, $currency, 'debit', $type, $description, $metadata);
    }

    public function transfer(int $fromUserId, int $toUserId, int $amount, string $currency, string $description = null, array $metadata = []): LedgerTransaction
    {
        return DB::transaction(function () use ($fromUserId, $toUserId, $amount, $currency, $description, $metadata) {
            $fromWallet = $this->getOrCreateWallet($fromUserId, $currency);
            $toWallet = $this->getOrCreateWallet($toUserId, $currency);

            if ($fromWallet->balance < $amount) {
                throw new RuntimeException('Insufficient balance.');
            }

            $txn = LedgerTransaction::create([
                'type'        => 'transfer_out',
                'description' => $description ?? "Transfer to user #{$toUserId}",
                'metadata'    => array_merge($metadata, ['from_user' => $fromUserId, 'to_user' => $toUserId]),
            ]);

            $fromNewBalance = $fromWallet->balance - $amount;
            $toNewBalance = $toWallet->balance + $amount;

            LedgerEntry::create([
                'ledger_transaction_id' => $txn->id,
                'account_type'          => 'user_wallet',
                'user_id'               => $fromUserId,
                'entry_type'            => 'debit',
                'amount'                => $amount,
                'currency'              => $currency,
                'balance_before'        => $fromWallet->balance,
                'balance_after'         => $fromNewBalance,
            ]);

            LedgerEntry::create([
                'ledger_transaction_id' => $txn->id,
                'account_type'          => 'user_wallet',
                'user_id'               => $toUserId,
                'entry_type'            => 'credit',
                'amount'                => $amount,
                'currency'              => $currency,
                'balance_before'        => $toWallet->balance,
                'balance_after'         => $toNewBalance,
            ]);

            $fromWallet->update(['balance' => $fromNewBalance]);
            $toWallet->update(['balance' => $toNewBalance]);

            return $txn->fresh(['entries']);
        });
    }

    public function creditWithFee(int $userId, int $grossAmount, int $feeAmount, string $currency, string $type, ?string $description = null, array $metadata = []): LedgerTransaction
    {
        return DB::transaction(function () use ($userId, $grossAmount, $feeAmount, $currency, $type, $description, $metadata) {
            $wallet = $this->getOrCreateWallet($userId, $currency);
            $platformWallet = $this->getOrCreateWallet($this->platformRevenueUserId, $currency);

            $netAmount = $grossAmount - $feeAmount;
            $newBalance = $wallet->balance + $netAmount;
            $platformNewBalance = $platformWallet->balance + $feeAmount;

            $txn = LedgerTransaction::create([
                'type'        => $type,
                'description' => $description,
                'metadata'    => $metadata,
            ]);

            LedgerEntry::create([
                'ledger_transaction_id' => $txn->id,
                'account_type'          => 'user_wallet',
                'user_id'               => $userId,
                'entry_type'            => 'credit',
                'amount'                => $netAmount,
                'currency'              => $currency,
                'balance_before'        => $wallet->balance,
                'balance_after'         => $newBalance,
            ]);

            LedgerEntry::create([
                'ledger_transaction_id' => $txn->id,
                'account_type'          => 'platform_revenue',
                'user_id'               => $this->platformRevenueUserId,
                'entry_type'            => 'credit',
                'amount'                => $feeAmount,
                'currency'              => $currency,
                'balance_before'        => $platformWallet->balance,
                'balance_after'         => $platformNewBalance,
            ]);

            $wallet->update(['balance' => $newBalance]);
            $platformWallet->update(['balance' => $platformNewBalance]);

            return $txn->fresh(['entries']);
        });
    }

    private function execute(int $userId, int $amount, string $currency, string $entryType, string $type, ?string $description, array $metadata): LedgerTransaction
    {
        return DB::transaction(function () use ($userId, $amount, $currency, $entryType, $type, $description, $metadata) {
            $wallet = $this->getOrCreateWallet($userId, $currency);

            if ($entryType === 'debit' && $wallet->balance < $amount) {
                throw new RuntimeException('Insufficient balance.');
            }

            $balanceBefore = $wallet->balance;
            $balanceAfter = $entryType === 'credit' ? $balanceBefore + $amount : $balanceBefore - $amount;

            $txn = LedgerTransaction::create([
                'type'        => $type,
                'description' => $description,
                'metadata'    => $metadata,
            ]);

            LedgerEntry::create([
                'ledger_transaction_id' => $txn->id,
                'account_type'          => 'user_wallet',
                'user_id'               => $userId,
                'entry_type'            => $entryType,
                'amount'                => $amount,
                'currency'              => $currency,
                'balance_before'        => $balanceBefore,
                'balance_after'         => $balanceAfter,
            ]);

            $wallet->update(['balance' => $balanceAfter]);

            return $txn->fresh(['entries']);
        });
    }

    public function getOrCreateWallet(int $userId, string $currency = 'NGN'): Wallet
    {
        return Wallet::firstOrCreate(
            ['user_id' => $userId],
            ['currency' => $currency, 'balance' => 0, 'status' => 'active'],
        );
    }
}
