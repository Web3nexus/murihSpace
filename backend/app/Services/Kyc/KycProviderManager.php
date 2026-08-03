<?php

namespace App\Services\Kyc;

use App\Services\Kyc\Didit\DiditKycProvider;
use App\Services\Kyc\ManualReviewKycProvider;
use InvalidArgumentException;

class KycProviderManager
{
    /** @var array<string, KycProviderInterface> */
    private array $providers = [];

    public function __construct(
        private readonly DiditKycProvider $didit,
        private readonly ManualReviewKycProvider $manual,
    ) {
        $this->providers = [
            $this->didit->name() => $this->didit,
            $this->manual->name() => $this->manual,
        ];
    }

    public function activeProviderName(): string
    {
        return (string) config('kyc.provider', 'manual');
    }

    public function provider(?string $name = null): KycProviderInterface
    {
        $name = $name ?? $this->activeProviderName();

        if (! isset($this->providers[$name])) {
            throw new InvalidArgumentException("Unknown KYC provider: {$name}");
        }

        return $this->providers[$name];
    }

    public function active(): KycProviderInterface
    {
        return $this->provider();
    }

    /**
     * @return array<string, KycProviderInterface>
     */
    public function all(): array
    {
        return $this->providers;
    }
}
