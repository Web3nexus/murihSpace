<?php

namespace App\Services;

use App\Models\Country;
use App\Models\User;

/**
 * Resolves a user's local currency.
 *
 * Priority:
 *   1. The user's profile country (users.country -> countries.currency).
 *   2. The country code of the user's mobile number (E.164 calling code match).
 *   3. USD as the platform-wide default currency.
 */
class LocalCurrencyResolver
{
    public const DEFAULT_CURRENCY = 'USD';

    /** @var array<string, array{country_code: string|null, currency: string, source: string}> */
    protected array $cache = [];

    public function resolve(?User $user): array
    {
        if ($user === null) {
            return $this->defaultContext();
        }

        $userKey = 'user:' . $user->id;
        if (! isset($this->cache[$userKey])) {
            $this->cache[$userKey] = $this->resolveUser($user);
        }

        return $this->cache[$userKey];
    }

    public function currency(?User $user): string
    {
        return $this->resolve($user)['currency'];
    }

    public function countryCode(?User $user): ?string
    {
        return $this->resolve($user)['country_code'];
    }

    private function resolveUser(User $user): array
    {
        if ($user->country) {
            $country = Country::find($user->country);
            if ($country && $country->currency) {
                return [
                    'country_code' => $country->iso2,
                    'currency'     => strtoupper($country->currency),
                    'source'       => 'profile',
                ];
            }
        }

        $phoneContext = $this->resolveFromMobileNumber($user->mobile_number);
        if ($phoneContext !== null) {
            return $phoneContext;
        }

        return $this->defaultContext();
    }

    /**
     * Derive the user's country/currency by matching the leading digits of their
     * E.164 mobile number against the countries calling-code table.
     */
    private function resolveFromMobileNumber(?string $mobileNumber): ?array
    {
        if (! $mobileNumber) {
            return null;
        }

        $digits = (string) preg_replace('/\D/', '', ltrim($mobileNumber, '+'));
        if ($digits === '') {
            return null;
        }

        $match = Country::query()
            ->whereNotNull('calling_code')
            ->get()
            ->filter(fn (Country $c) => (string) $c->calling_code !== '')
            ->sortByDesc(fn (Country $c) => strlen((string) $c->calling_code))
            ->first(function (Country $c) use ($digits) {
                $code = (string) preg_replace('/\D/', '', (string) $c->calling_code);

                return $code !== '' && str_starts_with($digits, $code);
            });

        if ($match && $match->currency) {
            return [
                'country_code' => $match->iso2,
                'currency'     => strtoupper($match->currency),
                'source'       => 'phone',
            ];
        }

        return null;
    }

    private function defaultContext(): array
    {
        return [
            'country_code' => null,
            'currency'     => self::DEFAULT_CURRENCY,
            'source'       => 'default',
        ];
    }
}