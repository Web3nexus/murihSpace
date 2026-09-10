<?php

namespace App\Services\Payment\Router;

use App\Enums\CapabilityStatus;
use App\Models\PaymentProvider;
use App\Models\ProviderCapability;
use App\Services\Payment\Contracts\PaymentProviderInterface;
use App\Services\Payment\Contracts\ProviderCapabilityInterface;

class CapabilityEngine
{
    /**
     * Checks whether a provider has an explicit, CONFIRMED capability.
     */
    public function canHandle(
        PaymentProvider $providerModel,
        PaymentProviderInterface $providerInstance,
        string $capability,
        string $currency,
        ?string $country = null,
        ?int $amount = null
    ): bool {
        // Rule: The system must NEVER assume a provider can perform an operation
        // simply because its name appears in configuration.

        $currency = strtoupper($currency);
        $country = $country ? strtoupper($country) : '*';

        // 1. Check database-backed capabilities
        $cap = ProviderCapability::where('payment_provider_id', $providerModel->id)
            ->where('capability', $capability)
            ->where(function ($q) use ($country) {
                $q->where('country_code', $country)->orWhere('country_code', '*');
            })
            ->where(function ($q) use ($currency) {
                $q->where('currency', $currency)->orWhere('currency', '*');
            })
            ->first();

        if ($cap) {
            if ($cap->status !== CapabilityStatus::Confirmed) {
                return false;
            }

            if ($amount !== null) {
                if ($cap->min_amount !== null && $amount < $cap->min_amount) {
                    return false;
                }
                if ($cap->max_amount !== null && $amount > $cap->max_amount) {
                    return false;
                }
            }

            return true;
        }

        // 2. Fallback to provider instance capability probe if not yet in DB
        if ($providerInstance instanceof ProviderCapabilityInterface) {
            return $providerInstance->supports($capability, $currency, $country === '*' ? null : $country);
        }

        return false;
    }
}
