<?php

namespace App\Services\NativeStore;

use App\Services\NativeStore\Contracts\StoreVerifier;
use App\Services\NativeStore\Exceptions\StoreVerificationException;
use Firebase\JWT\JWT;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

/**
 * Validates Google Play purchase tokens against the Play Developer API
 * (purchases.products.get). Authenticates with a service account via an
 * RS256-signed JWT assertion exchanged for an OAuth2 access token.
 */
class GooglePlayStoreVerifier implements StoreVerifier
{
    public function store(): string
    {
        return 'google';
    }

    public function verify(string $productId, string $token, ?string $expectedTransactionId = null): StoreVerificationResult
    {
        if (! $this->enabled()) {
            throw new StoreVerificationException('Google Play billing is not configured.');
        }

        if ($token === '') {
            return StoreVerificationResult::invalid('google', $productId, 'Missing purchase token.');
        }

        $accessToken = $this->accessToken();
        $package = config('payments.stores.google.package_name');

        $response = Http::withToken($accessToken)
            ->timeout((int) config('payments.stores.google.timeout', 30))
            ->acceptJson()
            ->get(rtrim((string) config('payments.stores.google.publisher_api_base'), '/').'/applications/'
                .rawurlencode((string) $package).'/purchases/products/'.rawurlencode($productId).'/tokens/'.rawurlencode($token));

        if ($response->failed() || $response->json('purchaseState') === null) {
            $status = $response->json('error.code');
            $reason = $response->json('error.status');

            if ($status === 404) {
                return StoreVerificationResult::invalid('google', $productId, 'Google Play has no record of this purchase.', $response->json() ?? []);
            }

            return StoreVerificationResult::invalid('google', $productId, 'Google Play could not verify the purchase.'.($reason ? " ({$reason})" : ''), $response->json() ?? []);
        }

        $purchaseState = (int) $response->json('purchaseState');
        $returnedProduct = $response->json('productId');

        if ($purchaseState !== 0) {
            return StoreVerificationResult::invalid('google', $productId, 'This purchase has not been completed.', ['purchaseState' => $purchaseState]);
        }

        if ($returnedProduct !== null && $returnedProduct !== $productId) {
            return StoreVerificationResult::invalid('google', $productId, 'Purchase is for a different product.', ['productId' => $returnedProduct]);
        }

        $orderId = $response->json('orderId');

        // Play Developer API purchase tokens are not reusable across accounts.
        $linkedAccount = $response->json('linkedPurchaseToken');
        if (is_string($linkedAccount) && $linkedAccount !== '') {
            return StoreVerificationResult::invalid('google', $productId, 'Purchase token is already linked to another purchase.');
        }

        return new StoreVerificationResult(
            valid: true,
            store: 'google',
            productId: $productId,
            transactionId: $token,
            orderId: $orderId,
            payload: [
                'purchase_time_millis' => $response->json('purchaseTimeMillis'),
                'consumption_state' => $response->json('consumptionState'),
                'obfuscated_external_account_id' => $response->json('obfuscatedExternalAccountId'),
            ],
        );
    }

    private function accessToken(): string
    {
        [$email, $key] = $this->credentials();
        $cacheKey = 'google_play_access_token_'.substr(md5($email), 0, 12);

        return Cache::remember($cacheKey, 3300, function () use ($email, $key) {
            $now = time();
            $assertion = JWT::encode([
                'iss' => $email,
                'scope' => 'https://www.googleapis.com/auth/androidpublisher',
                'aud' => config('payments.stores.google.token_url'),
                'iat' => $now,
                'exp' => $now + 3600,
            ], $key, 'RS256');

            $response = Http::asForm()
                ->timeout((int) config('payments.stores.google.timeout', 30))
                ->post(config('payments.stores.google.token_url'), [
                    'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                    'assertion' => $assertion,
                ]);

            if ($response->failed() || ! ($response->json('access_token') ?? null)) {
                throw new StoreVerificationException('Google Play service account authentication failed.');
            }

            return (string) $response->json('access_token');
        });
    }

    /**
     * @return array{0: string, 1: string} [service account email, RSA private key (PEM)]
     */
    private function credentials(): array
    {
        $jsonPath = config('payments.stores.google.service_account_json');

        if ($jsonPath) {
            if (is_string($jsonPath) && is_file($jsonPath)) {
                try {
                    $creds = json_decode((string) file_get_contents($jsonPath), true, 512, JSON_THROW_ON_ERROR);
                } catch (\JsonException $e) {
                    throw new StoreVerificationException('Google Play service account file is invalid.');
                }
            } else {
                try {
                    $creds = json_decode((string) $jsonPath, true, 512, JSON_THROW_ON_ERROR);
                } catch (\JsonException $e) {
                    throw new StoreVerificationException('Google Play service account credentials are invalid.');
                }
            }

            if (isset($creds['client_email'], $creds['private_key'])) {
                return [$creds['client_email'], $creds['private_key']];
            }
        }

        $email = (string) config('payments.stores.google.client_email');
        $key = (string) config('payments.stores.google.private_key');

        if ($email === '' || $key === '') {
            throw new StoreVerificationException('Google Play service account credentials are not configured.');
        }

        return [$email, $key];
    }

    private function enabled(): bool
    {
        return (bool) config('payments.stores.google.enabled', false);
    }
}