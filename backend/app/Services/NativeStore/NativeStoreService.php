<?php

namespace App\Services\NativeStore;

use App\Models\CoinPack;
use App\Services\NativeStore\Contracts\StoreVerifier;
use App\Services\NativeStore\Exceptions\StoreVerificationException;

/**
 * Coordinates native (app store) purchase verification. Native in-app purchases
 * are verified server-to-server against Apple / Google and deliberately bypass
 * all online payment providers (Paddle and friends play no role here).
 */
class NativeStoreService
{
    public function __construct(
        private readonly AppleStoreVerifier $apple,
        private readonly GooglePlayStoreVerifier $google,
    ) {}

    public function verifier(string $store): StoreVerifier
    {
        return match ($store) {
            'apple' => $this->apple,
            'google' => $this->google,
            default => throw new StoreVerificationException('Unsupported store.'),
        };
    }

    public function isStoreEnabled(string $store): bool
    {
        return (bool) config("payments.stores.{$store}.enabled", false);
    }

    /**
     * Resolve the store product id for a pack — pack override else configured prefix + total coins.
     */
    public function productIdForPack(CoinPack $pack, string $store): ?string
    {
        if ($store === 'apple') {
            return $pack->store_product_ios ?: $this->deriveProductId($pack, 'apple');
        }

        if ($store === 'google') {
            return $pack->store_product_android ?: $this->deriveProductId($pack, 'google');
        }

        return null;
    }

    public function deriveProductId(CoinPack $pack, string $store): string
    {
        return (string) config('payments.stores.product_prefix', 'com.murihspace.coins.')
            .($pack->coins + $pack->bonus_coins);
    }

    /**
     * Resolve the active coin pack that owns a store product id. Used when a
     * client reconciles a purchase by product id alone (e.g. past purchases
     * that never confirmed).
     */
    public function packForProduct(string $store, string $productId): ?CoinPack
    {
        $column = $store === 'apple' ? 'store_product_ios' : ($store === 'google' ? 'store_product_android' : null);

        if ($column) {
            $pack = CoinPack::query()->active()->where($column, $productId)->first();

            if ($pack) {
                return $pack;
            }
        }

        $prefix = (string) config('payments.stores.product_prefix', 'com.murihspace.coins.');

        if ($prefix !== '' && str_starts_with($productId, $prefix)) {
            $total = (int) substr($productId, strlen($prefix));

            if ($total > 0) {
                return CoinPack::query()->active()
                    ->whereRaw('coins + bonus_coins = ?', [$total])
                    ->first();
            }
        }

        return null;
    }

    public function verify(string $store, string $productId, string $token, ?string $expectedTransactionId = null): StoreVerificationResult
    {
        return $this->verifier($store)->verify($productId, $token, $expectedTransactionId);
    }
}