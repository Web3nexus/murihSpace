<?php

namespace App\Services\NativeStore\Contracts;

use App\Services\NativeStore\StoreVerificationResult;

interface StoreVerifier
{
    /**
     * Verify a client-supplied purchase token against the app store server-side.
     */
    public function verify(string $productId, string $token, ?string $expectedTransactionId = null): StoreVerificationResult;

    /**
     * Store key: 'apple' | 'google'.
     */
    public function store(): string;
}