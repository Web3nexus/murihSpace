<?php

namespace App\Services\NativeStore;

use App\Services\NativeStore\Contracts\StoreVerifier;
use App\Services\NativeStore\Exceptions\StoreVerificationException;
use Illuminate\Support\Facades\Http;

/**
 * Validates App Store receipts server-to-server via Apple's verifyReceipt
 * endpoint. This is the Apple-recommended trust boundary — the receipt data
 * is interpreted by Apple itself, so client-supplied keys are never used.
 *
 * Sandbox receipts sent to production (status 21007) and vice-versa (21008)
 * are automatically retried against the matching environment endpoint.
 */
class AppleStoreVerifier implements StoreVerifier
{
    public function store(): string
    {
        return 'apple';
    }

    public function verify(string $productId, string $token, ?string $expectedTransactionId = null): StoreVerificationResult
    {
        if (! $this->enabled()) {
            throw new StoreVerificationException('Apple App Store billing is not configured.');
        }

        $sharedSecret = (string) config('payments.stores.apple.shared_secret');
        if ($sharedSecret === '') {
            throw new StoreVerificationException('Apple App Store shared secret is not configured.');
        }

        if (! $this->looksLikeReceipt($token)) {
            return StoreVerificationResult::invalid('apple', $productId, 'Invalid App Store receipt data.');
        }

        $attempts = [
            'primary' => $this->endpointFor(config('payments.stores.apple.environment', 'sandbox')),
        ];
        if (config('payments.stores.apple.environment', 'sandbox') === 'sandbox') {
            $attempts['production'] = config('payments.stores.apple.verify_receipt_url');
        } else {
            $attempts['sandbox'] = config('payments.stores.apple.verify_receipt_sandbox_url');
        }

        $http = Http::timeout((int) config('payments.stores.apple.timeout', 30));
        $last = null;

        foreach ($attempts as $environment => $url) {
            try {
                $response = $http->asJson()->acceptJson()->post($url, [
                    'receipt-data' => $token,
                    'password' => $sharedSecret,
                    'exclude-old-transactions' => true,
                ]);
            } catch (\Throwable $e) {
                $last = new StoreVerificationException('Apple App Store is unreachable; please retry.');
                continue;
            }

            $status = (int) ($response->json('status') ?? -1);

            // 21007 sandbox receipt sent to production, 21008 the reverse.
            if ($status === 21007 && $environment === 'production') {
                continue;
            }
            if ($status === 21008 && $environment === 'sandbox') {
                continue;
            }

            if ($status !== 0) {
                return StoreVerificationResult::invalid('apple', $productId, 'App Store rejected the receipt.', ['status' => $status]);
            }

            return $this->matchesReceipt($productId, $expectedTransactionId, $response->json(), $environment === 'sandbox' ? 'sandbox' : 'production');
        }

        if ($last) {
            throw $last;
        }

        return StoreVerificationResult::invalid('apple', $productId, 'App Store rejected the receipt.');
    }

    private function matchesReceipt(string $productId, ?string $expectedTransactionId, array $payload, string $environment): StoreVerificationResult
    {
        $bundleId = $payload['receipt']['bundle_id'] ?? null;
        if ($bundleId !== null && $bundleId !== config('payments.stores.apple.bundle_id')) {
            return StoreVerificationResult::invalid('apple', $productId, 'Receipt belongs to a different app.', ['bundle_id' => $bundleId]);
        }

        $entries = $payload['latest_receipt_info'] ?? ($payload['receipt']['in_app'] ?? []);
        if (! is_array($entries)) {
            return StoreVerificationResult::invalid('apple', $productId, 'Receipt contains no purchases.');
        }

        $matches = array_values(array_filter($entries, fn ($e) => ($e['product_id'] ?? null) === $productId));

        if ($matches === []) {
            return StoreVerificationResult::invalid('apple', $productId, 'Receipt does not contain the purchased product.');
        }

        if ($expectedTransactionId) {
            $matchedTxn = array_values(array_filter($matches, fn ($e) => ($e['transaction_id'] ?? null) === $expectedTransactionId));
            if ($matchedTxn !== []) {
                $purchase = $matchedTxn[0];
            } else {
                return StoreVerificationResult::invalid('apple', $productId, "Receipt does not contain transaction {$expectedTransactionId}.");
            }
        } else {
            usort($matches, fn ($a, $b) => (($b['purchase_date_ms'] ?? 0) <=> ($a['purchase_date_ms'] ?? 0)));
            $purchase = $matches[0];
        }

        $transactionId = $purchase['transaction_id'] ?? null;

        if (! $transactionId) {
            return StoreVerificationResult::invalid('apple', $productId, 'App Store did not return a transaction id.');
        }

        return new StoreVerificationResult(
            valid: true,
            store: 'apple',
            productId: $productId,
            transactionId: (string) $transactionId,
            orderId: $purchase['web_order_line_item_id'] ?? $purchase['original_transaction_id'] ?? null,
            payload: [
                'environment' => $environment,
                'bundle_id' => $bundleId,
                'original_transaction_id' => $purchase['original_transaction_id'] ?? null,
                'purchase_date_ms' => $purchase['purchase_date_ms'] ?? null,
            ],
        );
    }

    private function looksLikeReceipt(string $token): bool
    {
        if ($token === '' || strlen($token) < 20) {
            return false;
        }
        // Apple app receipts are base64 blobs (often URL-safe variants).
        return preg_match('/^[A-Za-z0-9+\/=_-]+$/', $token) === 1;
    }

    private function endpointFor(string $environment): string
    {
        return $environment === 'production'
            ? config('payments.stores.apple.verify_receipt_url')
            : config('payments.stores.apple.verify_receipt_sandbox_url');
    }

    private function enabled(): bool
    {
        return (bool) config('payments.stores.apple.enabled', false);
    }
}