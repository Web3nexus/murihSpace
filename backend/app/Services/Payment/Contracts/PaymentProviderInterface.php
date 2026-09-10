<?php

namespace App\Services\Payment\Contracts;

interface PaymentProviderInterface
{
    /**
     * Unique identifier code for the provider (e.g. 'airwallex', 'paystack', 'flutterwave', 'murihpay').
     */
    public function providerCode(): string;

    /**
     * Human-readable display name.
     */
    public function providerName(): string;

    /**
     * Check if the provider is enabled and configured with required credentials.
     */
    public function isAvailable(): bool;

    /**
     * Performs a live connectivity check / ping against the provider's API.
     *
     * @return array{healthy: bool, latency_ms: int, message: string}
     */
    public function testConnection(): array;
}
