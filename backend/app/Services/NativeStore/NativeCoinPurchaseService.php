<?php

namespace App\Services\NativeStore;

use App\Models\CoinPack;
use App\Models\CoinPurchase;
use App\Models\NativeStorePurchase;
use App\Models\User;
use App\Services\NativeStore\Exceptions\StoreVerificationException;
use App\Services\Wallet\LedgerService;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Fulfils verified native store coin purchases: credits the user's system
 * wallet ledger, records the CoinPurchase (revenue) and the NativeStorePurchase
 * (audit + idempotency). A given store transaction id is never credited twice.
 */
class NativeCoinPurchaseService
{
    public function __construct(
        private readonly LedgerService $ledger,
        private readonly NativeStoreService $stores,
    ) {}

    public function intent(User $user, string $store, CoinPack $pack): array
    {
        $productId = $this->stores->productIdForPack($pack, $store);

        if (! $this->stores->isStoreEnabled($store)) {
            throw new StoreVerificationException('Native store billing is not configured.');
        }

        if (! $productId) {
            throw new StoreVerificationException('This coin pack has no store product for the selected platform.');
        }

        return [
            'store' => $store,
            'product_id' => $productId,
            'amount_minor' => $pack->price,
            'currency' => $pack->currency ?: 'USD',
            'coins' => $pack->coins,
            'bonus_coins' => $pack->bonus_coins,
            'total_coins' => $pack->coins + $pack->bonus_coins,
        ];
    }

    public function verifyAndCredit(
        User $user,
        CoinPack $pack,
        string $store,
        string $productId,
        string $token,
        ?string $transactionId = null,
        ?string $orderId = null
    ): array {
        $result = $this->stores->verify($store, $productId, $token, $transactionId);

        if (! $result->valid) {
            throw new StoreVerificationException($result->error ?: 'Store verification failed.');
        }

        $storeTxnId = $result->transactionId ?? $transactionId;
        $storeOrderId = $result->orderId ?? $orderId;

        if (! $storeTxnId) {
            throw new StoreVerificationException('The store did not return a transaction id.');
        }

        $existing = NativeStorePurchase::query()
            ->where('store', $store)
            ->where('store_transaction_id', $storeTxnId)
            ->first();

        if ($existing) {
            if ($existing->user_id !== $user->id) {
                throw new StoreVerificationException('This store transaction has already been claimed by another account.');
            }

            if ($existing->status === 'pending') {
                $this->settlePending($existing);
            }

            return $this->summary($pack, $existing, alreadyProcessed: true);
        }

        if ($pack->coins + $pack->bonus_coins < 1) {
            throw new StoreVerificationException('Coin pack does not grant any coins.');
        }

        $provider = $store === 'google' ? 'google_play' : 'apple_store';
        $internalReference = 'NSP-'.strtoupper(substr($store, 0, 1)).'-'.strtoupper(substr(hash('sha256', $storeTxnId), 0, 20));
        $creditKey = 'COIN_NATIVE_'.substr(hash('sha256', $store.':'.$storeTxnId), 0, 32);
        $creditedCoins = $pack->coins + $pack->bonus_coins;
        $amountMinor = $pack->price;

        try {
            $record = DB::transaction(function () use (
                $user, $pack, $store, $storeTxnId, $storeOrderId, $productId,
                $amountMinor, $creditedCoins, $internalReference, $creditKey, $provider, $result
            ) {
                $ledgerTxn = $this->ledger->credit(
                    user: $user,
                    amount: $creditedCoins,
                    currency: 'USD',
                    walletType: 'system',
                    balanceCategory: 'available',
                    type: 'coin_purchase',
                    description: "Coins purchased via {$provider} [{$storeTxnId}]",
                    idempotencyKey: $creditKey,
                    metadata: [
                        'store' => $store,
                        'store_transaction_id' => $storeTxnId,
                        'internal_reference' => $internalReference,
                        'store_product_id' => $productId,
                    ],
                );

                $record = NativeStorePurchase::create([
                    'user_id' => $user->id,
                    'coin_pack_id' => $pack->id,
                    'store' => $store,
                    'store_transaction_id' => $storeTxnId,
                    'store_order_id' => $storeOrderId,
                    'product_id' => $productId,
                    'amount_minor' => $amountMinor,
                    'currency' => $pack->currency ?: 'USD',
                    'credited_coins' => $creditedCoins,
                    'status' => 'completed',
                    'internal_reference' => $internalReference,
                    'ledger_transaction_id' => $ledgerTxn->id,
                    'payload' => $result->payload,
                ]);

                CoinPurchase::create([
                    'user_id' => $user->id,
                    'coin_pack_id' => $pack->id,
                    'coins' => $pack->coins,
                    'bonus_coins' => $pack->bonus_coins,
                    'amount_paid' => $amountMinor,
                    'currency' => $pack->currency ?: 'USD',
                    'status' => 'completed',
                    'provider' => $provider,
                    'reference' => $internalReference,
                    'tax' => 0,
                    'total_charged' => $amountMinor,
                    'tax_rate' => null,
                    'tax_type' => 'provider_handled',
                ]);

                return $record;
            });
        } catch (UniqueConstraintViolationException $e) {
            $existing = NativeStorePurchase::query()
                ->where('store', $store)
                ->where('store_transaction_id', $storeTxnId)
                ->first();

            if ($existing) {
                return $this->summary($pack, $existing, alreadyProcessed: true);
            }

            throw $e;
        }

        return $this->summary($pack, $record, alreadyProcessed: false);
    }

    private function settlePending(NativeStorePurchase $record): void
    {
        $provider = $record->store === 'google' ? 'google_play' : 'apple_store';
        $creditKey = 'COIN_NATIVE_'.substr(hash('sha256', $record->store.':'.$record->store_transaction_id), 0, 32);

        try {
            DB::transaction(function () use ($record, $provider, $creditKey) {
                $ledgerTxn = $this->ledger->credit(
                    user: (int) $record->user_id,
                    amount: $record->credited_coins,
                    currency: 'USD',
                    walletType: 'system',
                    balanceCategory: 'available',
                    type: 'coin_purchase',
                    description: "Coins purchased via {$provider} [{$record->store_transaction_id}]",
                    idempotencyKey: $creditKey,
                    metadata: ['store' => $record->store, 'store_transaction_id' => $record->store_transaction_id, 'internal_reference' => $record->internal_reference],
                );

                $record->update([
                    'status' => 'completed',
                    'ledger_transaction_id' => $ledgerTxn->id,
                ]);
            });
        } catch (\Throwable $e) {
            Log::warning('Could not settle pending native store purchase', ['id' => $record->id, 'error' => $e->getMessage()]);
        }
    }

    private function summary(CoinPack $pack, NativeStorePurchase $record, bool $alreadyProcessed): array
    {
        return [
            'ok' => true,
            'store' => $record->store,
            'store_transaction_id' => $record->store_transaction_id,
            'transaction_id' => $record->store_transaction_id,
            'internal_reference' => $record->internal_reference,
            'credited_coins' => (int) $record->credited_coins,
            'coins' => $pack->coins,
            'bonus_coins' => $pack->bonus_coins,
            'total_coins' => (int) $record->credited_coins,
            'amount_minor' => (int) $record->amount_minor,
            'currency' => $record->currency,
            'status' => $record->status,
            'already_processed' => $alreadyProcessed,
        ];
    }
}