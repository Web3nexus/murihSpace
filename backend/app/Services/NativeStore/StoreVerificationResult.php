<?php

namespace App\Services\NativeStore;

use App\Services\NativeStore\Contracts\StoreVerifier;

class StoreVerificationResult
{
    public function __construct(
        public readonly bool $valid,
        public readonly string $store,
        public readonly string $productId,
        public readonly ?string $transactionId = null,
        public readonly ?string $orderId = null,
        public readonly ?string $error = null,
        public readonly array $payload = [],
    ) {}

    public static function success(
        string $store,
        string $productId,
        string $transactionId,
        ?string $orderId = null,
        array $payload = []
    ): self {
        return new self(
            valid: true,
            store: $store,
            productId: $productId,
            transactionId: $transactionId,
            orderId: $orderId,
            payload: $payload
        );
    }

    public static function invalid(
        string $store,
        string $productId,
        string $error,
        array $payload = []
    ): self {
        return new self(valid: false, store: $store, productId: $productId, error: $error, payload: $payload);
    }

    public static function failure(
        string $store,
        string $error,
        string $productId = '',
        array $payload = []
    ): self {
        return self::invalid(store: $store, productId: $productId, error: $error, payload: $payload);
    }
}