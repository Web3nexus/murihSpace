<?php

namespace App\Services\Payment\Contracts;

interface ProviderCapabilityInterface
{
    /**
     * Checks if this provider natively supports an operation for a specific country/currency.
     */
    public function supports(string $capability, string $currency, ?string $country = null): bool;

    /**
     * List all supported currencies for payment collection.
     *
     * @return string[]
     */
    public function supportedCurrencies(): array;

    /**
     * List all supported countries for payment collection.
     *
     * @return string[]
     */
    public function supportedCountries(): array;
}
