<?php

namespace App\Services\Payment\Providers;

use App\Enums\PaymentStatus;
use App\Services\Payment\Contracts\CollectionProviderInterface;
use App\Services\Payment\Contracts\ProviderCapabilityInterface;
use App\Services\Payment\Contracts\ProviderWebhookInterface;
use App\Services\Payment\DTO\NormalizedWebhookEvent;
use App\Services\Payment\DTO\PaymentIntentRequest;
use App\Services\Payment\DTO\PaymentIntentResponse;
use App\Services\Payment\DTO\PaymentVerificationResult;
use App\Services\Payment\Exceptions\PaymentException;
use App\Services\Payment\Exceptions\ProviderUnavailableException;
use Exception;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Paddle — Merchant of Record for digital goods (coins, gifts, wallet top-ups).
 *
 * Integrates the Paddle 2.0 Transactions API (server-to-server hosted checkout)
 * plus signed webhook events. As a Merchant of Record, Paddle collects and remits
 * VAT/sales tax itself, so callers should skip their own tax computation whenever
 * this provider is routed (`handles_tax`).
 */
class PaddleProvider implements CollectionProviderInterface, ProviderWebhookInterface, ProviderCapabilityInterface
{
    protected string $baseUrl;

    protected ?string $apiKey;

    protected ?string $clientToken;

    protected ?string $webhookKey;

    protected bool $enabled;

    protected int $timeout;

    public function __construct()
    {
        $cfg = config('payments.providers.paddle', []);
        $this->baseUrl = rtrim((string) ($cfg['base_url'] ?? 'https://sandbox-api.paddle.com'), '/');
        $this->apiKey = $cfg['api_key'] ?? null;
        $this->clientToken = $cfg['client_token'] ?? null;
        $this->webhookKey = $cfg['webhook_public_key'] ?? $cfg['webhook_secret'] ?? null;
        $this->enabled = (bool) ($cfg['enabled'] ?? false);
        $this->timeout = (int) ($cfg['timeout'] ?? 30);
    }

    public function providerCode(): string
    {
        return 'paddle';
    }

    public function providerName(): string
    {
        return 'Paddle (Merchant of Record)';
    }

    /**
     * Whether the provider collects/remits tax (VAT) itself.
     */
    public function handlesTax(): bool
    {
        return (bool) config('payments.providers.paddle.handles_tax', true);
    }

    public function isAvailable(): bool
    {
        return $this->enabled && ! empty($this->apiKey);
    }

    public function testConnection(): array
    {
        $startTime = hrtime(true);
        try {
            if (empty($this->apiKey)) {
                throw new ProviderUnavailableException('paddle', 'Paddle API key is missing.');
            }

            $res = Http::withToken($this->apiKey)
                ->timeout($this->timeout)
                ->get("{$this->baseUrl}/transactions", ['limit' => 1]);

            $latencyMs = (int) round((hrtime(true) - $startTime) / 1e6);

            if ($res->successful()) {
                return [
                    'healthy' => true,
                    'latency_ms' => $latencyMs,
                    'message' => 'Paddle API authentication verified successfully.',
                ];
            }

            return [
                'healthy' => false,
                'latency_ms' => $latencyMs,
                'message' => 'Paddle API returned error: '.($res->json('error.detail') ?? $res->body()),
            ];
        } catch (Exception $e) {
            $latencyMs = (int) round((hrtime(true) - $startTime) / 1e6);

            return [
                'healthy' => false,
                'latency_ms' => $latencyMs,
                'message' => 'Paddle connection error: '.$e->getMessage(),
            ];
        }
    }

    /**
     * Create a draft transaction and return its hosted checkout URL.
     *
     * Paddle amounts: unit_price.amount is a decimal string in major units.
     */
    public function createPaymentIntent(PaymentIntentRequest $request): PaymentIntentResponse
    {
        if (empty($this->apiKey)) {
            throw new ProviderUnavailableException('paddle', 'Paddle API key is missing.');
        }

        $majorAmount = number_format($request->amount / 100, 2, '.', '');

        $payload = [
            'items' => [
                [
                    'quantity' => 1,
                    'price' => [
                        'unit_price' => [
                            'amount' => $majorAmount,
                            'currency_code' => strtoupper($request->currency),
                        ],
                    ],
                ],
            ],
            'currency_code' => strtoupper($request->currency),
            'custom_data' => array_merge($request->metadata, [
                'internal_reference' => $request->internalReference,
                'public_reference' => $request->publicReference,
            ]),
            'return_url' => $request->returnUrl,
            'customer' => [
                'email' => $request->customerEmail,
                'name' => $request->customerName ?? null,
            ],
        ];

        $res = Http::withToken($this->apiKey)
            ->timeout($this->timeout)
            ->asJson()
            ->post("{$this->baseUrl}/transactions", $payload);

        if (! $res->successful()) {
            Log::error('Paddle transaction creation failed', [
                'status' => $res->status(),
                'body' => $res->json(),
            ]);

            throw new PaymentException(
                'Paddle transaction creation failed: '.($res->json('error.detail') ?? $res->body()),
                'PADDLE_TRANSACTION_CREATE_FAILED',
                $res->status()
            );
        }

        $data = $res->json('data') ?? [];
        $id = (string) ($data['id'] ?? '');
        $checkoutUrl = (string) ($data['checkout']['url'] ?? '');

        return new PaymentIntentResponse(
            provider: 'paddle',
            providerReference: $id,
            providerTransactionId: $id,
            redirectUrl: $checkoutUrl,
            metadata: [
                'transaction_id' => $id,
                'totals' => $data['details']['totals'] ?? [],
            ],
            rawResponse: $res->json() ?? [],
        );
    }

    /**
     * Server-side verification: GET /transactions/{id} and require status "completed".
     * The reported amount is the pre-tax subtotal so that amount re-verification
     * matches the internal net amount when Paddle (MoR) added its own tax.
     */
    public function verifyPayment(string $reference, array $context = []): PaymentVerificationResult
    {
        if (empty($this->apiKey)) {
            throw new ProviderUnavailableException('paddle', 'Paddle API key is missing.');
        }

        $res = Http::withToken($this->apiKey)
            ->timeout($this->timeout)
            ->get("{$this->baseUrl}/transactions/{$reference}");

        if (! $res->successful()) {
            return new PaymentVerificationResult(
                isSuccessful: false,
                status: PaymentStatus::Failed,
                providerReference: $reference,
                failureReason: 'Paddle verification failed: '.($res->json('error.detail') ?? $res->body()),
                rawResponse: $res->json() ?? [],
            );
        }

        $data = $res->json('data') ?? [];
        $rawStatus = strtolower((string) ($data['status'] ?? ''));
        $totals = $data['details']['totals'] ?? [];

        $amountMinor = isset($totals['subtotal'])
            ? $this->toMinorUnits((string) $totals['subtotal'])
            : null;

        $status = match ($rawStatus) {
            'completed' => PaymentStatus::Successful,
            'canceled' => PaymentStatus::Expired,
            'failed' => PaymentStatus::Failed,
            default => PaymentStatus::Processing,
        };

        return new PaymentVerificationResult(
            isSuccessful: $status === PaymentStatus::Successful,
            status: $status,
            providerReference: $reference,
            providerTransactionId: (string) ($data['id'] ?? $reference),
            amount: $amountMinor,
            currency: $data['currency_code'] ?? null,
            failureReason: $data['failure_reason'] ?? null,
            rawResponse: $res->json() ?? [],
        );
    }

    /**
     * Paddle 2.0 webhook signature: `Paddle-Webhook-Signature: ts=<t>;h1=<b64>`,
     * signed as `ts:<rawBody>` with an Ed25519 key (the dashboard public key).
     */
    public function verifyWebhookSignature(Request $request): bool
    {
        if (empty($this->webhookKey) || ! function_exists('sodium_crypto_sign_verify_detached')) {
            Log::warning('Paddle webhook key missing or libsodium unavailable.');

            return false;
        }

        $header = (string) $request->header('paddle-webhook-signature');
        if (empty($header)) {
            return false;
        }

        // e.g. `ts=1710000000;h1=AbCd...`
        $parts = [];
        foreach (explode(';', $header) as $pair) {
            [$k, $v] = array_pad(explode('=', $pair, 2), 2, '');
            $parts[trim($k)] = trim($v);
        }

        $ts = (int) ($parts['ts'] ?? 0);
        $signature = $parts['h1'] ?? ($parts['signature'] ?? ($parts['v1'] ?? ''));

        if ($ts === 0 || empty($signature)) {
            return false;
        }

        // Replay protection within webhook tolerance window
        if (abs(time() - $ts) > (int) config('payments.webhooks.tolerance_seconds', 300)) {
            Log::warning('Paddle webhook timestamp outside tolerance window.', ['ts' => $ts]);

            return false;
        }

        $publicKey = $this->normalizePublicKey($this->webhookKey);
        if ($publicKey === null) {
            return false;
        }

        $payload = $ts.':'.$request->getContent();

        try {
            return sodium_crypto_sign_verify_detached(base64_decode($signature, true), $payload, $publicKey);
        } catch (Exception $e) {
            Log::warning('Paddle webhook signature verification failed', ['error' => $e->getMessage()]);

            return false;
        }
    }

    public function parseWebhookEvent(Request $request): NormalizedWebhookEvent
    {
        $payload = $request->json()->all();
        $eventType = (string) ($payload['event_type'] ?? $payload['event'] ?? 'unknown');
        $data = $payload['data'] ?? [];

        $eventId = (string) ($data['id'] ?? ('paddle_'.md5($request->getContent())));
        $reference = (string) ($data['custom_data']['internal_reference'] ?? $data['id'] ?? '');
        $totals = $data['details']['totals'] ?? [];
        $gross = isset($totals['gross']) ? $this->toMinorUnits((string) $totals['gross']) : null;

        $status = match (strtolower($eventType)) {
            'transaction.completed', 'transaction.payment_succeeded' => 'successful',
            'transaction.canceled', 'transaction.failed' => 'failed',
            default => 'processing',
        };

        return new NormalizedWebhookEvent(
            provider: 'paddle',
            eventId: $eventId,
            eventType: $eventType,
            resourceReference: $reference,
            status: $status,
            amount: $gross,
            currency: $data['currency_code'] ?? null,
            payload: $payload,
            timestamp: (string) ($payload['created_at'] ?? now()->toISOString()),
        );
    }

    public function supports(string $capability, string $currency, ?string $country = null): bool
    {
        // The hosted checkout presents card, Apple Pay (WebKit) and Google Pay
        // wallets itself, so all three collect capabilities are supported.
        return in_array(strtoupper($currency), ['USD', 'EUR', 'GBP'])
            && in_array($capability, ['card', 'apple_pay', 'google_pay', 'wallet']);
    }

    public function supportedCurrencies(): array
    {
        return ['USD', 'EUR', 'GBP'];
    }

    public function supportedCountries(): array
    {
        return ['*'];
    }

    /**
     * Convert a Paddle money string (major units like "12.34" or minor ints) to minor units.
     */
    protected function toMinorUnits(string $value): int
    {
        $value = trim($value);
        if ($value === '' || $value === '0') {
            return 0;
        }

        if (str_contains($value, '.')) {
            return (int) round(((float) $value) * 100);
        }

        return (int) $value;
    }

    /**
     * Accept either a hex-encoded key (as shown in the Paddle dashboard) or
     * a raw/base64 Ed25519 public key.
     */
    protected function normalizePublicKey(string $key): ?string
    {
        if (function_exists('sodium_hex2bin') && ctype_xdigit($key)) {
            return sodium_hex2bin($key);
        }

        if (function_exists('sodium_base642bin')) {
            try {
                return sodium_base642bin($key, SODIUM_BASE64_VARIANT_ORIGINAL);
            } catch (Exception) {
                // fall through to return null
            }
        }

        return strlen($key) === SODIUM_CRYPTO_SIGN_PUBLICKEYBYTES ? $key : null;
    }
}