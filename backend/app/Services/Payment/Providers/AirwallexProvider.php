<?php

namespace App\Services\Payment\Providers;

use App\Enums\PaymentStatus;
use App\Enums\PayoutStatus;
use App\Enums\RefundStatus;
use App\Services\Payment\Contracts\CollectionProviderInterface;
use App\Services\Payment\Contracts\PayoutProviderInterface;
use App\Services\Payment\Contracts\ProviderCapabilityInterface;
use App\Services\Payment\Contracts\ProviderWebhookInterface;
use App\Services\Payment\Contracts\RefundProviderInterface;
use App\Services\Payment\DTO\NormalizedWebhookEvent;
use App\Services\Payment\DTO\PaymentIntentRequest;
use App\Services\Payment\DTO\PaymentIntentResponse;
use App\Services\Payment\DTO\PaymentVerificationResult;
use App\Services\Payment\DTO\PayoutRequest;
use App\Services\Payment\DTO\PayoutResponse;
use App\Services\Payment\DTO\RefundRequest;
use App\Services\Payment\DTO\RefundResponse;
use App\Services\Payment\Exceptions\PaymentException;
use App\Services\Payment\Exceptions\ProviderUnavailableException;
use Carbon\Carbon;
use Exception;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class AirwallexProvider implements CollectionProviderInterface, PayoutProviderInterface, ProviderCapabilityInterface, ProviderWebhookInterface, RefundProviderInterface
{
    protected string $baseUrl;

    protected ?string $clientId;

    protected ?string $apiKey;

    protected ?string $webhookSecret;

    protected int $timeout;

    public function __construct()
    {
        $cfg = config('payments.providers.airwallex', []);
        $this->baseUrl = rtrim((string) ($cfg['base_url'] ?? 'https://api-demo.airwallex.com/api/v1'), '/');
        $this->clientId = $cfg['client_id'] ?? null;
        $this->apiKey = $cfg['api_key'] ?? null;
        $this->webhookSecret = $cfg['webhook_secret'] ?? null;
        $this->timeout = (int) ($cfg['timeout'] ?? 30);
    }

    public function providerCode(): string
    {
        return 'airwallex';
    }

    public function providerName(): string
    {
        return 'Airwallex';
    }

    public function isAvailable(): bool
    {
        return (bool) config('payments.providers.airwallex.enabled', false)
            && ! empty($this->clientId)
            && ! empty($this->apiKey);
    }

    public function testConnection(): array
    {
        $startTime = hrtime(true);
        try {
            $token = $this->getAccessToken(forceRefresh: true);
            $latencyMs = (int) round((hrtime(true) - $startTime) / 1e6);

            return [
                'healthy' => ! empty($token),
                'latency_ms' => $latencyMs,
                'message' => 'Airwallex API authentication successful.',
            ];
        } catch (Exception $e) {
            $latencyMs = (int) round((hrtime(true) - $startTime) / 1e6);

            return [
                'healthy' => false,
                'latency_ms' => $latencyMs,
                'message' => 'Airwallex connection failed: '.$e->getMessage(),
            ];
        }
    }

    /**
     * Get or refresh Bearer Access Token via POST /api/v1/authentication/login.
     */
    protected function getAccessToken(bool $forceRefresh = false): string
    {
        $cacheKey = 'airwallex_token_'.md5((string) $this->clientId);

        if (! $forceRefresh && Cache::has($cacheKey)) {
            return (string) Cache::get($cacheKey);
        }

        if (empty($this->clientId) || empty($this->apiKey)) {
            throw new ProviderUnavailableException('airwallex', 'Airwallex credentials not configured.');
        }

        $res = Http::withHeaders([
            'x-client-id' => $this->clientId,
            'x-api-key' => $this->apiKey,
            'Content-Type' => 'application/json',
        ])->timeout($this->timeout)->post("{$this->baseUrl}/authentication/login");

        if (! $res->successful()) {
            Log::error('Airwallex authentication failed', ['status' => $res->status(), 'body' => $res->json()]);
            throw new ProviderUnavailableException('airwallex', 'Failed to authenticate with Airwallex: '.$res->body());
        }

        $data = $res->json();
        $token = $data['token'] ?? null;
        $expiresAt = isset($data['expires_at']) ? Carbon::parse($data['expires_at']) : now()->addMinutes(25);

        if (! $token) {
            throw new ProviderUnavailableException('airwallex', 'Airwallex authentication response missing token.');
        }

        $ttl = max(60, $expiresAt->diffInSeconds(now()) - 300); // 5 min safety margin
        Cache::put($cacheKey, $token, $ttl);

        return (string) $token;
    }

    /**
     * Create Payment Intent (POST /api/v1/pa/payment_intents/create).
     */
    public function createPaymentIntent(PaymentIntentRequest $request): PaymentIntentResponse
    {
        $token = $this->getAccessToken();

        // Airwallex Payment Intent requires decimal amount in major unit (e.g. 10.00)
        $decimalAmount = round($request->amount / 100, 2);

        $payload = [
            'request_id' => $request->idempotencyKey ?: $request->internalReference,
            'amount' => $decimalAmount,
            'currency' => strtoupper($request->currency),
            'merchant_order_id' => $request->publicReference,
            'return_url' => $request->returnUrl,
            'customer' => [
                'email' => $request->customerEmail,
                'name' => $request->customerName,
            ],
            'metadata' => array_merge($request->metadata, [
                'internal_reference' => $request->internalReference,
                'platform' => 'MurihSpace',
            ]),
        ];

        $res = Http::withToken($token)
            ->timeout($this->timeout)
            ->post("{$this->baseUrl}/pa/payment_intents/create", $payload);

        if (! $res->successful()) {
            Log::error('Airwallex createPaymentIntent failed', ['status' => $res->status(), 'response' => $res->json()]);
            throw new PaymentException(
                'Airwallex payment initialization failed: '.($res->json('message') ?? $res->body()),
                'AIRWALLEX_INTENT_FAILED',
                $res->status()
            );
        }

        $data = $res->json();
        $intentId = $data['id'] ?? '';
        $clientSecret = $data['client_secret'] ?? null;

        // Hosted payment redirect URL or fallback to Airwallex checkout link
        $redirectUrl = $data['next_action']['url'] ?? "https://checkout.airwallex.com/#/checkout?id={$intentId}&client_secret={$clientSecret}";

        return new PaymentIntentResponse(
            provider: 'airwallex',
            providerReference: $intentId,
            providerTransactionId: $intentId,
            redirectUrl: $redirectUrl,
            clientSecret: $clientSecret,
            metadata: $data,
            rawResponse: $data,
        );
    }

    /**
     * Verify Payment Intent (GET /api/v1/pa/payment_intents/{id}).
     */
    public function verifyPayment(string $reference, array $context = []): PaymentVerificationResult
    {
        $token = $this->getAccessToken();

        $res = Http::withToken($token)
            ->timeout($this->timeout)
            ->get("{$this->baseUrl}/pa/payment_intents/{$reference}");

        if (! $res->successful()) {
            return new PaymentVerificationResult(
                isSuccessful: false,
                status: PaymentStatus::Failed,
                providerReference: $reference,
                failureReason: 'Unable to retrieve Airwallex payment intent: '.$res->body(),
                rawResponse: $res->json() ?? [],
            );
        }

        $data = $res->json();
        $statusStr = strtoupper((string) ($data['status'] ?? ''));
        $amountMinor = isset($data['amount']) ? (int) round(((float) $data['amount']) * 100) : null;
        $currency = $data['currency'] ?? null;

        $internalStatus = match ($statusStr) {
            'SUCCEEDED' => PaymentStatus::Successful,
            'CANCELLED' => PaymentStatus::Cancelled,
            'REQUIRES_PAYMENT_METHOD', 'PENDING' => PaymentStatus::Pending,
            default => PaymentStatus::Failed,
        };

        return new PaymentVerificationResult(
            isSuccessful: $internalStatus === PaymentStatus::Successful,
            status: $internalStatus,
            providerReference: $reference,
            providerTransactionId: $data['latest_payment_attempt']['id'] ?? $reference,
            amount: $amountMinor,
            currency: $currency,
            failureReason: $data['latest_payment_attempt']['failure_message'] ?? null,
            rawResponse: $data,
        );
    }

    /**
     * Initiate Payout (POST /api/v1/payouts/transfers/create).
     */
    public function initiatePayout(PayoutRequest $request): PayoutResponse
    {
        $token = $this->getAccessToken();
        $decimalAmount = round($request->amount / 100, 2);

        $payload = [
            'request_id' => $request->idempotencyKey,
            'source_currency' => strtoupper($request->currency),
            'transfer_amount' => $decimalAmount,
            'payment_method' => $request->destinationDetails['payment_method'] ?? 'LOCAL',
            'reason' => $request->narration,
            'beneficiary' => [
                'bank_details' => [
                    'account_number' => $request->destinationDetails['account_number'] ?? '',
                    'bank_code' => $request->destinationDetails['bank_code'] ?? '',
                    'swift_code' => $request->destinationDetails['swift_code'] ?? null,
                ],
                'name' => $request->destinationDetails['account_name'] ?? '',
                'entity_type' => 'PERSONAL',
            ],
        ];

        $res = Http::withToken($token)
            ->timeout($this->timeout)
            ->post("{$this->baseUrl}/payouts/transfers/create", $payload);

        if (! $res->successful()) {
            Log::error('Airwallex initiatePayout failed', ['status' => $res->status(), 'body' => $res->json()]);

            return new PayoutResponse(
                provider: 'airwallex',
                providerPayoutId: '',
                providerReference: $request->internalReference,
                status: PayoutStatus::Failed,
                failureReason: $res->json('message') ?? $res->body(),
                rawResponse: $res->json() ?? [],
            );
        }

        $data = $res->json();
        $transferId = $data['id'] ?? '';
        $transferStatus = strtoupper((string) ($data['status'] ?? ''));

        $status = match ($transferStatus) {
            'SETTLED', 'SUCCEEDED' => PayoutStatus::Successful,
            'CANCELLED', 'FAILED' => PayoutStatus::Failed,
            default => PayoutStatus::Processing,
        };

        return new PayoutResponse(
            provider: 'airwallex',
            providerPayoutId: $transferId,
            providerReference: $transferId,
            status: $status,
            feeAmount: isset($data['fee']) ? (int) round(((float) $data['fee']) * 100) : 0,
            rawResponse: $data,
        );
    }

    public function verifyPayout(string $providerPayoutId): array
    {
        $token = $this->getAccessToken();
        $res = Http::withToken($token)->get("{$this->baseUrl}/payouts/transfers/{$providerPayoutId}");

        if (! $res->successful()) {
            return ['status' => 'failed', 'raw' => $res->json() ?? []];
        }

        $data = $res->json();
        $rawStatus = strtoupper((string) ($data['status'] ?? ''));
        $status = match ($rawStatus) {
            'SETTLED', 'SUCCEEDED' => 'successful',
            'CANCELLED', 'FAILED' => 'failed',
            default => 'processing',
        };

        return ['status' => $status, 'raw' => $data];
    }

    /**
     * Process Refund (POST /api/v1/pa/refunds/create).
     */
    public function processRefund(RefundRequest $request): RefundResponse
    {
        $token = $this->getAccessToken();
        $decimalAmount = round($request->amount / 100, 2);

        $payload = [
            'request_id' => $request->idempotencyKey,
            'payment_intent_id' => $request->providerPaymentId,
            'amount' => $decimalAmount,
            'reason' => $request->reason,
        ];

        $res = Http::withToken($token)
            ->timeout($this->timeout)
            ->post("{$this->baseUrl}/pa/refunds/create", $payload);

        if (! $res->successful()) {
            return new RefundResponse(
                provider: 'airwallex',
                providerRefundId: '',
                status: RefundStatus::Failed,
                failureReason: $res->json('message') ?? $res->body(),
                rawResponse: $res->json() ?? [],
            );
        }

        $data = $res->json();
        $refundId = $data['id'] ?? '';
        $rawStatus = strtoupper((string) ($data['status'] ?? ''));

        $status = match ($rawStatus) {
            'SUCCEEDED' => RefundStatus::Successful,
            'PENDING', 'PROCESSING' => RefundStatus::Processing,
            default => RefundStatus::Failed,
        };

        return new RefundResponse(
            provider: 'airwallex',
            providerRefundId: $refundId,
            status: $status,
            rawResponse: $data,
        );
    }

    /**
     * Webhook Signature Verification:
     * Airwallex sends `x-timestamp` and `x-signature`.
     * Signature = HMAC-SHA256(x-timestamp + payload, webhookSecret).
     */
    public function verifyWebhookSignature(Request $request): bool
    {
        if (empty($this->webhookSecret)) {
            Log::warning('Airwallex webhook secret not configured. Signature rejected.');

            return false;
        }

        $signature = $request->header('x-signature');
        $timestamp = $request->header('x-timestamp');
        $payload = $request->getContent();

        if (empty($signature) || empty($timestamp)) {
            return false;
        }

        $computed = hash_hmac('sha256', $timestamp.$payload, $this->webhookSecret);

        return hash_equals($computed, $signature);
    }

    public function parseWebhookEvent(Request $request): NormalizedWebhookEvent
    {
        $payload = $request->json()->all();
        $eventId = (string) ($payload['id'] ?? ('awx_'.md5($request->getContent())));
        $eventType = (string) ($payload['name'] ?? '');
        $data = $payload['data']['object'] ?? [];

        $resourceRef = (string) ($data['id'] ?? $data['merchant_order_id'] ?? '');
        $amountMinor = isset($data['amount']) ? (int) round(((float) $data['amount']) * 100) : null;
        $currency = $data['currency'] ?? null;

        $status = match ($eventType) {
            'payment_intent.succeeded' => 'successful',
            'payment_intent.payment_attempt_failed' => 'failed',
            'payment_intent.cancelled' => 'cancelled',
            'payout.succeeded', 'transfer.succeeded' => 'successful',
            'payout.failed', 'transfer.failed' => 'failed',
            'refund.succeeded' => 'successful',
            default => 'processing',
        };

        return new NormalizedWebhookEvent(
            provider: 'airwallex',
            eventId: $eventId,
            eventType: $eventType,
            resourceReference: $resourceRef,
            status: $status,
            amount: $amountMinor,
            currency: $currency,
            payload: $payload,
            timestamp: (string) ($payload['create_time'] ?? now()->toISOString()),
        );
    }

    public function supports(string $capability, string $currency, ?string $country = null): bool
    {
        $currency = strtoupper($currency);

        if ($capability === 'mobile_money') {
            return false; // Airwallex does not support African Mobile Money
        }

        if (in_array($currency, ['USD', 'EUR', 'GBP', 'AUD', 'CAD', 'SGD', 'HKD', 'JPY', 'CNY', 'CHF', 'NZD'])) {
            return true;
        }

        return false;
    }

    public function supportedCurrencies(): array
    {
        return ['USD', 'EUR', 'GBP', 'AUD', 'CAD', 'SGD', 'HKD', 'JPY', 'CNY', 'CHF', 'NZD'];
    }

    public function supportedCountries(): array
    {
        return ['US', 'GB', 'CA', 'AU', 'SG', 'HK', 'DE', 'FR', 'NL', 'JP', 'NZ', 'CH'];
    }
}
