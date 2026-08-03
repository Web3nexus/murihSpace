<?php

namespace App\Services\Kyc;

use App\Models\AdminSetting;
use App\Services\Kyc\Didit\DiditKycProvider;
use App\Services\Kyc\ManualReviewKycProvider;
use App\Services\Kyc\Sumsub\SumsubKycProvider;
use InvalidArgumentException;

class KycProviderManager
{
    /** @var array<string, KycProviderInterface> */
    private array $providers = [];

    public function __construct(
        private readonly DiditKycProvider $didit,
        private readonly SumsubKycProvider $sumsub,
        private readonly ManualReviewKycProvider $manual,
    ) {
        $this->providers = [
            $this->didit->name() => $this->didit,
            $this->sumsub->name() => $this->sumsub,
            $this->manual->name() => $this->manual,
        ];
    }

    /**
     * Providers the admin has selected to be available (KYC_PROVIDERS / kyc_providers setting).
     */
    public function selectedProviderNames(): array
    {
        $setting = AdminSetting::get('kyc_providers', null);

        if (is_string($setting) && $setting !== '' && $setting !== '[]') {
            $decoded = json_decode($setting, true);
            if (is_array($decoded) && $decoded !== []) {
                return array_values(array_intersect($decoded, array_keys($this->providers)));
            }
        }

        // Fall back to config (KYC_PROVIDERS env or legacy KYC_PROVIDER).
        $fromConfig = array_filter(array_map(
            fn ($v) => trim($v),
            (array) config('kyc.providers'),
        ));

        return array_values(array_intersect($fromConfig, array_keys($this->providers)));
    }

    /**
     * Providers that are both admin-selected AND fully configured for use.
     *
     * @return array<string, KycProviderInterface>
     */
    public function enabledProviders(): array
    {
        $enabled = [];

        foreach ($this->selectedProviderNames() as $name) {
            $provider = $this->providers[$name] ?? null;
            if ($provider !== null && $provider->isEnabled()) {
                $enabled[$name] = $provider;
            }
        }

        return $enabled;
    }

    /**
     * The first enabled provider (used when no explicit choice is made).
     * Automated providers are preferred over the manual fallback.
     */
    public function active(): KycProviderInterface
    {
        $enabled = $this->enabledProviders();

        if ($enabled === []) {
            // Nothing configured/enabled — fall back to the manual provider.
            return $this->manual;
        }

        // Prefer an automated provider (didit/sumsub) over manual review.
        foreach ($enabled as $name => $provider) {
            if ($name !== 'manual') {
                return $provider;
            }
        }

        return reset($enabled);
    }

    public function activeProviderName(): string
    {
        $enabled = $this->enabledProviders();

        if ($enabled === []) {
            return 'manual';
        }

        foreach ($enabled as $name => $_provider) {
            if ($name !== 'manual') {
                return $name;
            }
        }

        return array_key_first($enabled);
    }

    public function provider(?string $name = null): KycProviderInterface
    {
        $name = $name ?? $this->activeProviderName();

        if (! isset($this->providers[$name])) {
            throw new InvalidArgumentException("Unknown KYC provider: {$name}");
        }

        return $this->providers[$name];
    }

    /**
     * @return array<string, KycProviderInterface>
     */
    public function all(): array
    {
        return $this->providers;
    }
}
