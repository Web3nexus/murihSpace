<?php

namespace App\Services\Wallet;

use App\Models\LedgerEntry;
use App\Models\LedgerTransaction;
use App\Models\User;
use App\Models\Wallet;
use App\Models\WalletHold;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class LedgerService
{
    public function __construct(
        private readonly WalletService $walletService = new WalletService(),
        private ?int $platformRevenueUserId = null,
    ) {}

    /**
     * Credit a user's wallet category.
     * Enforces double-entry: balance entry for user + corresponding entry for transaction.
     */
    public function credit(
        User|int $user,
        int $amount,
        string $currency = 'NGN',
        string $walletType = 'system',
        string $balanceCategory = 'available',
        string $type = 'deposit',
        ?string $description = null,
        ?string $idempotencyKey = null,
        array $metadata = []
    ): LedgerTransaction {
        return $this->executeTransaction(
            user: $user,
            amount: $amount,
            currency: $currency,
            entryType: 'credit',
            walletType: $walletType,
            balanceCategory: $balanceCategory,
            type: $type,
            description: $description,
            idempotencyKey: $idempotencyKey,
            metadata: $metadata
        );
    }

    /**
     * Debit a user's wallet category.
     */
    public function debit(
        User|int $user,
        int $amount,
        string $currency = 'NGN',
        string $walletType = 'system',
        string $balanceCategory = 'available',
        string $type = 'payment',
        ?string $description = null,
        ?string $idempotencyKey = null,
        array $metadata = []
    ): LedgerTransaction {
        return $this->executeTransaction(
            user: $user,
            amount: $amount,
            currency: $currency,
            entryType: 'debit',
            walletType: $walletType,
            balanceCategory: $balanceCategory,
            type: $type,
            description: $description,
            idempotencyKey: $idempotencyKey,
            metadata: $metadata
        );
    }

    /**
     * Peer-to-peer transfer between users (System Wallet -> System Wallet).
     */
    public function transfer(
        int $fromUserId,
        int $toUserId,
        int $amount,
        string $currency = 'NGN',
        ?string $description = null,
        ?string $idempotencyKey = null,
        array $metadata = []
    ): LedgerTransaction {
        if ($amount <= 0) {
            throw new RuntimeException('Transfer amount must be greater than zero.');
        }

        return $this->runIdempotent(function () use ($fromUserId, $toUserId, $amount, $currency, $description, $idempotencyKey, $metadata) {
            if ($idempotencyKey) {
                $existing = LedgerTransaction::where('idempotency_key', $idempotencyKey)->first();
                if ($existing) return $existing->load('entries');
            }

            $fromUser = User::findOrFail($fromUserId);
            $toUser   = User::findOrFail($toUserId);

            // Ensure both wallets exist before locking so the lock order is stable.
            // Two reciprocal transfers that both create a missing wallet can otherwise
            // acquire row locks in opposite order and deadlock.
            $this->walletService->getOrCreateWallet($fromUser, 'system', $currency);
            $this->walletService->getOrCreateWallet($toUser, 'system', $currency);

            // Lock both wallet rows in a deterministic order to prevent deadlocks
            // when reciprocal transfers occur simultaneously.
            Wallet::whereIn('user_id', [$fromUserId, $toUserId])
                ->where('wallet_type', 'system')
                ->orderBy('user_id')
                ->lockForUpdate()
                ->get();

            $fromWallet = Wallet::where('user_id', $fromUserId)->where('wallet_type', 'system')->lockForUpdate()->firstOrFail();

            if ($fromWallet->available < $amount) {
                throw new RuntimeException('Insufficient available balance for transfer.');
            }

            $toWallet = Wallet::where('user_id', $toUserId)->where('wallet_type', 'system')->lockForUpdate()->firstOrFail();

            if ($fromWallet->currency !== $currency || $toWallet->currency !== $currency) {
                throw new RuntimeException(
                    "Currency mismatch: transfer requested in {$currency} but wallets are in "
                    . "{$fromWallet->currency} and {$toWallet->currency}."
                );
            }

            $txn = LedgerTransaction::create([
                'idempotency_key' => $idempotencyKey,
                'type'            => 'transfer_out',
                'status'          => 'completed',
                'description'     => $description ?? "Transfer to user #{$toUserId}",
                'initiated_by'    => $fromUserId,
                'metadata'        => array_merge($metadata, ['from_user' => $fromUserId, 'to_user' => $toUserId]),
            ]);

            $fromBefore = $fromWallet->available;
            $fromAfter  = $fromBefore - $amount;
            $fromWallet->update(['available' => $fromAfter]);

            LedgerEntry::create([
                'ledger_transaction_id' => $txn->id,
                'account_type'          => 'user_wallet',
                'wallet_type'           => 'system',
                'balance_category'      => 'available',
                'user_id'               => $fromUserId,
                'entry_type'            => 'debit',
                'amount'                => $amount,
                'currency'              => $currency,
                'balance_before'        => $fromBefore,
                'balance_after'         => $fromAfter,
            ]);

            $toBefore = $toWallet->available;
            $toAfter  = $toBefore + $amount;
            $toWallet->update(['available' => $toAfter]);

            LedgerEntry::create([
                'ledger_transaction_id' => $txn->id,
                'account_type'          => 'user_wallet',
                'wallet_type'           => 'system',
                'balance_category'      => 'available',
                'user_id'               => $toUserId,
                'entry_type'            => 'credit',
                'amount'                => $amount,
                'currency'              => $currency,
                'balance_before'        => $toBefore,
                'balance_after'         => $toAfter,
            ]);

            return $txn->fresh(['entries']);
        }, $idempotencyKey);
    }

    /**
     * Internal wallet transfer (e.g. Creator Wallet -> System Wallet or Business Wallet -> System Wallet).
     * Disallows spending directly from creator/business earnings — user must transfer to system wallet first.
     */
    public function internalTransfer(
        User $user,
        string $fromWalletType,
        string $toWalletType = 'system',
        int $amount = 0,
        int $feeAmount = 0,
        string $currency = 'NGN',
        ?string $idempotencyKey = null
    ): LedgerTransaction {
        if (! in_array($fromWalletType, ['creator', 'business'], true) || $toWalletType !== 'system') {
            throw new RuntimeException('Internal transfer must move funds from creator or business wallet to system wallet.');
        }

        if ($amount <= 0) {
            throw new RuntimeException('Transfer amount must be greater than zero.');
        }

        $netCredit = $amount - $feeAmount;

        if ($feeAmount < 0 || $netCredit <= 0) {
            throw new RuntimeException('Transfer amount must exceed the applicable fee.');
        }

        return $this->runIdempotent(function () use ($user, $fromWalletType, $toWalletType, $amount, $feeAmount, $netCredit, $currency, $idempotencyKey) {
            if ($idempotencyKey) {
                $existing = LedgerTransaction::where('idempotency_key', $idempotencyKey)->first();
                if ($existing) return $existing->load('entries');
            }

            $sourceWallet = Wallet::where('user_id', $user->id)->where('wallet_type', $fromWalletType)->lockForUpdate()->first();
            if (! $sourceWallet || $sourceWallet->available < $amount) {
                throw new RuntimeException("Insufficient available balance in {$fromWalletType} wallet.");
            }

            if ($sourceWallet->currency !== $currency) {
                throw new RuntimeException(
                    "Currency mismatch: internal transfer requested in {$currency} but source wallet is in {$sourceWallet->currency}."
                );
            }

            $destWallet = Wallet::where('user_id', $user->id)->where('wallet_type', $toWalletType)->lockForUpdate()->first();
            if (! $destWallet) {
                $created    = $this->walletService->getOrCreateWallet($user, $toWalletType, $currency);
                $destWallet = Wallet::whereKey($created->id)->lockForUpdate()->firstOrFail();
            }

            if ($destWallet->currency !== $currency) {
                throw new RuntimeException(
                    "Currency mismatch: internal transfer requested in {$currency} but destination wallet is in {$destWallet->currency}."
                );
            }

            $txn = LedgerTransaction::create([
                'idempotency_key' => $idempotencyKey,
                'type'            => 'internal_transfer',
                'status'          => 'completed',
                'description'     => "Internal transfer: {$fromWalletType} wallet → {$toWalletType} wallet",
                'initiated_by'    => $user->id,
                'metadata'        => [
                    'from_wallet_type' => $fromWalletType,
                    'to_wallet_type'   => $toWalletType,
                    'gross_amount'     => $amount,
                    'fee_amount'       => $feeAmount,
                    'net_amount'       => $netCredit,
                ],
            ]);

            // Debit source wallet
            $srcBefore = $sourceWallet->available;
            $srcAfter  = $srcBefore - $amount;
            $sourceWallet->update(['available' => $srcAfter]);

            LedgerEntry::create([
                'ledger_transaction_id' => $txn->id,
                'account_type'          => 'user_wallet',
                'wallet_type'           => $fromWalletType,
                'balance_category'      => 'available',
                'user_id'               => $user->id,
                'entry_type'            => 'debit',
                'amount'                => $amount,
                'currency'              => $currency,
                'balance_before'        => $srcBefore,
                'balance_after'         => $srcAfter,
            ]);

            // Credit destination system wallet with net amount
            $dstBefore = $destWallet->available;
            $dstAfter  = $dstBefore + $netCredit;
            $destWallet->update(['available' => $dstAfter]);

            LedgerEntry::create([
                'ledger_transaction_id' => $txn->id,
                'account_type'          => 'user_wallet',
                'wallet_type'           => $toWalletType,
                'balance_category'      => 'available',
                'user_id'               => $user->id,
                'entry_type'            => 'credit',
                'amount'                => $netCredit,
                'currency'              => $currency,
                'balance_before'        => $dstBefore,
                'balance_after'         => $dstAfter,
            ]);

            // If fee charged, credit platform revenue account
            if ($feeAmount > 0) {
                $platformUserId = $this->platformRevenueUserId ?? (int) config('wallet.platform_revenue_user_id', 1);
                $platformUser   = User::find($platformUserId);
                if (! $platformUser) {
                    throw new RuntimeException('Platform revenue account is not configured. Set wallet.platform_revenue_user_id in config.');
                }

                $platformWallet = Wallet::where('user_id', $platformUser->id)->where('wallet_type', 'system')->lockForUpdate()->first();
                if (! $platformWallet) {
                    $created        = $this->walletService->getOrCreateWallet($platformUser, 'system', $currency);
                    $platformWallet = Wallet::whereKey($created->id)->lockForUpdate()->firstOrFail();
                }

                if ($platformWallet->currency !== $currency) {
                    throw new RuntimeException(
                        "Currency mismatch: fee is in {$currency} but the platform revenue wallet is in {$platformWallet->currency}."
                    );
                }

                $platBefore = $platformWallet->available;
                $platAfter  = $platBefore + $feeAmount;
                $platformWallet->update(['available' => $platAfter]);

                LedgerEntry::create([
                    'ledger_transaction_id' => $txn->id,
                    'account_type'          => 'platform_revenue',
                    'wallet_type'           => 'system',
                    'balance_category'      => 'available',
                    'user_id'               => $platformUser->id,
                    'entry_type'            => 'credit',
                    'amount'                => $feeAmount,
                    'currency'              => $currency,
                    'balance_before'        => $platBefore,
                    'balance_after'         => $platAfter,
                ]);
            }

            return $txn->fresh(['entries']);
        }, $idempotencyKey);
    }

    /**
     * Credit the platform revenue account (System Wallet) with a fee.
     * Used so total debits == total credits whenever a fee is retained.
     */
    public function creditPlatformRevenue(
        int $amount,
        string $currency,
        string $description,
        ?string $idempotencyKey = null,
        array $metadata = []
    ): LedgerTransaction {
        if ($amount <= 0) {
            throw new RuntimeException('Platform revenue amount must be greater than zero.');
        }

        return $this->runIdempotent(function () use ($amount, $currency, $description, $idempotencyKey, $metadata) {
            if ($idempotencyKey) {
                $existing = LedgerTransaction::where('idempotency_key', $idempotencyKey)->first();
                if ($existing) return $existing->load('entries');
            }

            $platformUserId = $this->platformRevenueUserId ?? (int) config('wallet.platform_revenue_user_id', 1);
            $platformUser   = User::find($platformUserId);
            if (! $platformUser) {
                throw new RuntimeException('Platform revenue account is not configured. Set wallet.platform_revenue_user_id in config.');
            }

            $platformWallet = Wallet::where('user_id', $platformUser->id)->where('wallet_type', 'system')->lockForUpdate()->first();
            if (! $platformWallet) {
                $created        = $this->walletService->getOrCreateWallet($platformUser, 'system', $currency);
                $platformWallet = Wallet::whereKey($created->id)->lockForUpdate()->firstOrFail();
            }

            if ($platformWallet->currency !== $currency) {
                throw new RuntimeException(
                    "Currency mismatch: platform revenue requested in {$currency} but wallet is in {$platformWallet->currency}."
                );
            }

            $platBefore = $platformWallet->available;
            $platAfter  = $platBefore + $amount;
            $platformWallet->update(['available' => $platAfter]);

            $txn = LedgerTransaction::create([
                'idempotency_key' => $idempotencyKey,
                'type'            => 'platform_fee',
                'status'          => 'completed',
                'description'     => $description,
                'initiated_by'    => $platformUser->id,
                'metadata'        => $metadata,
            ]);

            LedgerEntry::create([
                'ledger_transaction_id' => $txn->id,
                'account_type'          => 'platform_revenue',
                'wallet_type'           => 'system',
                'balance_category'      => 'available',
                'user_id'               => $platformUser->id,
                'entry_type'            => 'credit',
                'amount'                => $amount,
                'currency'              => $currency,
                'balance_before'        => $platBefore,
                'balance_after'         => $platAfter,
            ]);

            return $txn->fresh(['entries']);
        }, $idempotencyKey);
    }

    /**
     * Freeze funds by moving from 'available' to 'reserved' / 'escrow' / 'pending'.
     */
    public function placeHold(
        User $user,
        int $amount,
        string $walletType = 'system',
        string $balanceCategory = 'reserved',
        string $reason = 'Order escrow hold',
        ?string $refType = null,
        ?string $refId = null
    ): WalletHold {
        $this->assertCategory($balanceCategory);

        if ($amount <= 0) {
            throw new RuntimeException('Hold amount must be greater than zero.');
        }

        return DB::transaction(function () use ($user, $amount, $walletType, $balanceCategory, $reason, $refType, $refId) {
            $wallet = Wallet::where('user_id', $user->id)->where('wallet_type', $walletType)->lockForUpdate()->firstOrFail();

            if ($wallet->status !== 'active') {
                throw new RuntimeException("Wallet is {$wallet->status}; cannot place a hold.");
            }

            if ($wallet->available < $amount) {
                throw new RuntimeException('Insufficient available balance to place hold.');
            }

            // Move available -> target category
            $wallet->available -= $amount;
            $wallet->{$balanceCategory} = ($wallet->{$balanceCategory} ?? 0) + $amount;
            $wallet->save();

            return WalletHold::create([
                'user_id'          => $user->id,
                'wallet_id'        => $wallet->id,
                'wallet_type'      => $walletType,
                'amount'           => $amount,
                'currency'         => $wallet->currency,
                'balance_category' => $balanceCategory,
                'reason'           => $reason,
                'reference_type'   => $refType,
                'reference_id'     => $refId,
                'status'           => 'active',
            ]);
        });
    }

    /**
     * Release frozen funds back to 'available'.
     */
    public function releaseHold(WalletHold $hold): WalletHold
    {
        return DB::transaction(function () use ($hold) {
            // Re-fetch with a row lock so two concurrent releases cannot both
            // observe an active hold and credit the funds twice.
            $hold = WalletHold::whereKey($hold->getKey())->lockForUpdate()->firstOrFail();

            if ($hold->status !== 'active') {
                throw new RuntimeException('Hold is not active.');
            }

            $wallet = Wallet::where('id', $hold->wallet_id)->lockForUpdate()->firstOrFail();
            $cat    = $hold->balance_category;

            $this->assertCategory($cat);

            $held = (int) ($wallet->{$cat} ?? 0);
            if ($held < $hold->amount) {
                throw new RuntimeException(
                    "Cannot release hold #{$hold->id}: {$cat} balance ({$held}) is less than the held amount ({$hold->amount})."
                );
            }

            $wallet->{$cat} = $held - $hold->amount;
            $wallet->available += $hold->amount;
            $wallet->save();

            $hold->update([
                'status'      => 'released',
                'released_at' => now(),
            ]);

            return $hold;
        });
    }

    /**
     * Validate that the balance category is a known Wallet::CATEGORIES value.
     * Prevents typos from silently creating unmapped attributes or overwriting
     * critical columns (e.g. pin_hash, currency) via dynamic property assignment.
     */
    private function assertCategory(string $balanceCategory): void
    {
        if (! in_array($balanceCategory, Wallet::CATEGORIES, true)) {
            throw new RuntimeException("Invalid wallet balance category: '{$balanceCategory}'. Must be one of: " . implode(', ', Wallet::CATEGORIES));
        }
    }

    private function executeTransaction(
        User|int $user,
        int $amount,
        string $currency,
        string $entryType,
        string $walletType,
        string $balanceCategory,
        string $type,
        ?string $description,
        ?string $idempotencyKey,
        array $metadata
    ): LedgerTransaction {
        $this->assertCategory($balanceCategory);

        if ($amount <= 0) {
            throw new RuntimeException('Ledger amount must be greater than zero.');
        }

        $userId  = $user instanceof User ? $user->id : $user;
        $userObj = $user instanceof User ? $user : User::findOrFail($userId);

        return $this->runIdempotent(function () use ($userObj, $userId, $amount, $currency, $entryType, $walletType, $balanceCategory, $type, $description, $idempotencyKey, $metadata) {
            if ($idempotencyKey) {
                $existing = LedgerTransaction::where('idempotency_key', $idempotencyKey)->first();
                if ($existing) return $existing->load('entries');
            }

            $wallet = Wallet::where('user_id', $userId)->where('wallet_type', $walletType)->lockForUpdate()->first();
            if (! $wallet) {
                $created = $this->walletService->getOrCreateWallet($userObj, $walletType, $currency);
                $wallet  = Wallet::whereKey($created->id)->lockForUpdate()->firstOrFail();
            }

            // Use the wallet's own currency — reject mismatches to prevent ledger divergence
            if ($wallet->currency !== $currency) {
                throw new RuntimeException(
                    "Currency mismatch: wallet is in {$wallet->currency} but credit/debit requested in {$currency}. " .
                    'Use the wallet currency or initiate a conversion.'
                );
            }

            $currentVal = $wallet->{$balanceCategory} ?? 0;

            if ($entryType === 'debit' && $currentVal < $amount) {
                throw new RuntimeException("Insufficient {$balanceCategory} balance in {$walletType} wallet.");
            }

            $balanceBefore = $currentVal;
            $balanceAfter  = $entryType === 'credit' ? $balanceBefore + $amount : $balanceBefore - $amount;

            $wallet->{$balanceCategory} = $balanceAfter;
            $wallet->save();

            $txn = LedgerTransaction::create([
                'idempotency_key' => $idempotencyKey,
                'type'            => $type,
                'status'          => 'completed',
                'description'     => $description,
                'initiated_by'    => $userId,
                'metadata'        => $metadata,
            ]);

            LedgerEntry::create([
                'ledger_transaction_id' => $txn->id,
                'account_type'          => 'user_wallet',
                'wallet_type'           => $walletType,
                'balance_category'      => $balanceCategory,
                'user_id'               => $userId,
                'entry_type'            => $entryType,
                'amount'                => $amount,
                'currency'              => $currency,
                'balance_before'        => $balanceBefore,
                'balance_after'         => $balanceAfter,
            ]);

            return $txn->fresh(['entries']);
        }, $idempotencyKey);
    }

    /**
     * Run a ledger mutation inside a DB transaction, returning the existing
     * transaction when a concurrent request wins the idempotency race.
     *
     * The ledger_transactions.idempotency_key column is unique, so a second
     * request with the same key that passes the check-then-act lookup will
     * fail on insert. We roll the losing write back and return the winner.
     */
    private function runIdempotent(callable $callback, ?string $idempotencyKey): LedgerTransaction
    {
        try {
            return DB::transaction($callback);
        } catch (UniqueConstraintViolationException $e) {
            if ($idempotencyKey) {
                $existing = LedgerTransaction::where('idempotency_key', $idempotencyKey)->first();
                if ($existing) {
                    return $existing->load('entries');
                }
            }

            throw $e;
        }
    }
}
