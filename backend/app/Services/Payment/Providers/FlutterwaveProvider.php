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
use Exception;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class FlutterwaveProvider implements CollectionProviderInterface, PayoutProviderInterface, ProviderCapabilityInterface, ProviderWebhookInterface, RefundProviderInterface
{
    protected string $baseUrl;

    protected ?string $publicKey;

    protected ?string $secretKey;

    protected ?string $webhookSecretHash;

    protected int $timeout;

    public function __construct()
    {
        $cfg = config('payments.providers.flutterwave', []);
        $this->baseUrl = rtrim((string) ($cfg['base_url'] ?? 'https://api.flutterwave.com/v3'), '/');
        $this->publicKey = $cfg['public_key'] ?? null;
        $this->secretKey = $cfg['secret_key'] ?? null;
        $this->webhookSecretHash = $cfg['webhook_secret_hash'] ?? null;
        $this->timeout = (int) ($cfg['timeout'] ?? 30);
    }

    public function providerCode(): string
    {
        return 'flutterwave';
    }

    public function providerName(): string
    {
        return 'Flutterwave';
    }

    public function isAvailable(): bool
    {
        return (bool) config('payments.providers.flutterwave.enabled', false)
            && ! empty($this->secretKey);
    }

    public function testConnection(): array
    {
        $startTime = hrtime(true);
        try {
            if (empty($this->secretKey)) {
                throw new ProviderUnavailableException('flutterwave', 'Flutterwave secret key is not configured.');
            }

            // Test authentication using Flutterwave balances endpoint
            $res = Http::withToken($this->secretKey)
                ->timeout($this->timeout)
                ->get("{$this->baseUrl}/balances");

            $latencyMs = (int) round((hrtime(true) - $startTime) / 1e6);

            if ($res->successful() && $res->json('status') === 'success') {
                return [
                    'healthy' => true,
                    'latency_ms' => $latencyMs,
                    'message' => 'Flutterwave API authentication verified successfully.',
                ];
            }

            return [
                'healthy' => false,
                'latency_ms' => $latencyMs,
                'message' => 'Flutterwave returned error: '.($res->json('message') ?? $res->body()),
            ];
        } catch (Exception $e) {
            $latencyMs = (int) round((hrtime(true) - $startTime) / 1e6);

            return [
                'healthy' => false,
                'latency_ms' => $latencyMs,
                'message' => 'Flutterwave connection error: '.$e->getMessage(),
            ];
        }
    }

    /**
     * Standard Hosted Payment (POST /v3/payments).
     */
    public function createPaymentIntent(PaymentIntentRequest $request): PaymentIntentResponse
    {
        if (empty($this->secretKey)) {
            throw new ProviderUnavailableException('flutterwave', 'Flutterwave secret key is missing.');
        }

        // Flutterwave expects decimal amount in standard unit
        $decimalAmount = round($request->amount / 100, 2);

        $payload = [
            'tx_ref' => $request->publicReference,
            'amount' => $decimalAmount,
            'currency' => strtoupper($request->currency),
            'redirect_url' => $request->returnUrl,
            'customer' => [
                'email' => $request->customerEmail,
                'name' => $request->customerName,
            ],
            'meta' => array_merge($request->metadata, [
                'internal_reference' => $request->internalReference,
                'platform' => 'MurihSpace',
            ]),
            'customizations' => [
                'title' => 'MurihSpace Payment',
                'description' => 'Secure checkout on MurihSpace',
            ],
        ];

        $res = Http::withToken($this->secretKey)
            ->timeout($this->timeout)
            ->post("{$this->baseUrl}/payments", $payload);

        if (! $res->successful() || $res->json('status') !== 'success') {
            Log::error('Flutterwave create payment failed', ['status' => $res->status(), 'body' => $res->json()]);
            throw new PaymentException(
                'Flutterwave payment initialization failed: '.($res->json('message') ?? $res->body()),
                'FLUTTERWAVE_INIT_FAILED',
                $res->status()
            );
        }

        $link = $res->json('data.link');

        return new PaymentIntentResponse(
            provider: 'flutterwave',
            providerReference: $request->publicReference,
            providerTransactionId: null,
            redirectUrl: $link,
            clientSecret: null,
            metadata: $res->json('data') ?? [],
            rawResponse: $res->json() ?? [],
        );
    }

    /**
     * Mandatory Re-Verification (GET /v3/transactions/{id}/verify).
     * Reference parameter can be a numeric Flutterwave transaction ID or the tx_ref.
     */
    public function verifyPayment(string $reference, array $context = []): PaymentVerificationResult
    {
        if (empty($this->secretKey)) {
            throw new ProviderUnavailableException('flutterwave', 'Flutterwave secret key is missing.');
        }

        // If numeric, query /v3/transactions/{id}/verify
        // If string tx_ref, query /v3/transactions/verify_by_reference?tx_ref=...
        $endpoint = is_numeric($reference)
            ? "{$this->baseUrl}/transactions/{$reference}/verify"
            : "{$this->baseUrl}/transactions/verify_by_reference?tx_ref=".urlencode($reference);

        $res = Http::withToken($this->secretKey)
            ->timeout($this->timeout)
            ->get($endpoint);

        if (! $res->successful() || $res->json('status') !== 'success') {
            return new PaymentVerificationResult(
                isSuccessful: false,
                status: PaymentStatus::Failed,
                providerReference: $reference,
                failureReason: 'Flutterwave verification failed: '.($res->json('message') ?? $res->body()),
                rawResponse: $res->json() ?? [],
            );
        }

        $data = $res->json('data') ?? [];
        $rawStatus = strtolower((string) ($data['status'] ?? ''));
        $flwTxRef = (string) ($data['tx_ref'] ?? '');
        $flwId = (string) ($data['id'] ?? '');
        $amountMinor = isset($data['amount']) ? (int) round(((float) $data['amount']) * 100) : null;
        $currency = $data['currency'] ?? null;

        $status = match ($rawStatus) {
            'successful' => PaymentStatus::Successful,
            'failed' => PaymentStatus::Failed,
            'pending' => PaymentStatus::Pending,
            'cancelled' => PaymentStatus::Cancelled,
            default => PaymentStatus::Failed,
        };

        return new PaymentVerificationResult(
            isSuccessful: $status === PaymentStatus::Successful,
            status: $status,
            providerReference: $flwTxRef ?: $reference,
            providerTransactionId: $flwId,
            amount: $amountMinor,
            currency: $currency,
            failureReason: $data['processor_response'] ?? null,
            rawResponse: $res->json() ?? [],
        );
    }

    /**
     * Initiate Payout (POST /v3/transfers).
     */
    public function initiatePayout(PayoutRequest $request): PayoutResponse
    {
        if (empty($this->secretKey)) {
            throw new ProviderUnavailableException('flutterwave', 'Flutterwave secret key is missing.');
        }

        $decimalAmount = round($request->amount / 100, 2);

        $payload = [
            'account_bank' => $request->destinationDetails['bank_code'] ?? '',
            'account_number' => $request->destinationDetails['account_number'] ?? '',
            'amount' => $decimalAmount,
            'narration' => $request->narration,
            'currency' => strtoupper($request->currency),
            'reference' => $request->publicReference,
            'debit_currency' => strtoupper($request->currency),
        ];

        $res = Http::withToken($this->secretKey)
            ->timeout($this->timeout)
            ->post("{$this->baseUrl}/transfers", $payload);

        if (! $res->successful() || $res->json('status') !== 'success') {
            Log::error('Flutterwave payout failed', ['status' => $res->status(), 'body' => $res->json()]);

            return new PayoutResponse(
                provider: 'flutterwave',
                providerPayoutId: '',
                providerReference: $request->publicReference,
                status: PayoutStatus::Failed,
                failureReason: $res->json('message') ?? $res->body(),
                rawResponse: $res->json() ?? [],
            );
        }

        $data = $res->json('data') ?? [];
        $transferId = (string) ($data['id'] ?? '');
        $rawStatus = strtoupper((string) ($data['status'] ?? 'NEW'));

        $status = match ($rawStatus) {
            'SUCCESSFUL' => PayoutStatus::Successful,
            'FAILED' => PayoutStatus::Failed,
            default => PayoutStatus::Processing,
        };

        return new PayoutResponse(
            provider: 'flutterwave',
            providerPayoutId: $transferId,
            providerReference: $request->publicReference,
            status: $status,
            feeAmount: isset($data['fee']) ? (int) round(((float) $data['fee']) * 100) : 0,
            rawResponse: $res->json() ?? [],
        );
    }

    public function verifyPayout(string $providerPayoutId): array
    {
        $res = Http::withToken($this->secretKey)->get("{$this->baseUrl}/transfers/{$providerPayoutId}");
        if (! $res->successful()) {
            return ['status' => 'failed', 'raw' => $res->json() ?? []];
        }

        $rawStatus = strtoupper((string) $res->json('data.status'));
        $status = match ($rawStatus) {
            'SUCCESSFUL' => 'successful',
            'FAILED' => 'failed',
            default => 'processing',
        };

        return ['status' => $status, 'raw' => $res->json() ?? []];
    }

    /**
     * Process Refund (POST /v3/transactions/{id}/refund).
     */
    public function processRefund(RefundRequest $request): RefundResponse
    {
        if (empty($this->secretKey)) {
            throw new ProviderUnavailableException('flutterwave', 'Flutterwave secret key is missing.');
        }

        $decimalAmount = round($request->amount / 100, 2);
        $payload = [
            'amount' => $decimalAmount,
            'comments' => $request->reason,
        ];

        $res = Http::withToken($this->secretKey)
            ->timeout($this->timeout)
            ->post("{$this->baseUrl}/transactions/{$request->providerPaymentId}/refund", $payload);

        if (! $res->successful() || $res->json('status') !== 'success') {
            return new RefundResponse(
                provider: 'flutterwave',
                providerRefundId: '',
                status: RefundStatus::Failed,
                failureReason: $res->json('message') ?? $res->body(),
                rawResponse: $res->json() ?? [],
            );
        }

        $refundId = (string) ($res->json('data.id') ?? '');

        return new RefundResponse(
            provider: 'flutterwave',
            providerRefundId: $refundId,
            status: RefundStatus::Processing,
            rawResponse: $res->json() ?? [],
        );
    }

    /**
     * Webhook Signature Verification:
     * Flutterwave sends `verif-hash` header which matches the secret hash set in Flutterwave dashboard.
     */
    public function verifyWebhookSignature(Request $request): bool
    {
        if (empty($this->webhookSecretHash)) {
            Log::warning('Flutterwave webhook secret hash not configured.');

            return false;
        }

        $headerSignature = $request->header('verif-hash');

        if (empty($headerSignature)) {
            return false;
        }

        return hash_equals($this->webhookSecretHash, $headerSignature);
    }

    public function parseWebhookEvent(Request $request): NormalizedWebhookEvent
    {
        $payload = $request->json()->all();
        $event = (string) ($payload['event'] ?? 'charge.completed');
        $data = $payload['data'] ?? [];

        $eventId = (string) ($data['id'] ?? ('flw_'.md5($request->getContent())));
        $txRef = (string) ($data['tx_ref'] ?? '');
        $rawStatus = strtolower((string) ($data['status'] ?? ''));
        $amountMinor = isset($data['amount']) ? (int) round(((float) $data['amount']) * 100) : null;
        $currency = $data['currency'] ?? null;

        $status = match ($rawStatus) {
            'successful' => 'successful',
            'failed' => 'failed',
            'pending' => 'processing',
            default => 'processing',
        };

        return new NormalizedWebhookEvent(
            provider: 'flutterwave',
            eventId: $eventId,
            eventType: $event,
            resourceReference: $txRef,
            status: $status,
            amount: $amountMinor,
            currency: $currency,
            payload: $payload,
            timestamp: (string) ($data['created_at'] ?? now()->toISOString()),
        );
    }

    public function supports(string $capability, string $currency, ?string $country = null): bool
    {
        $currency = strtoupper($currency);

        if ($capability === 'mobile_money') {
            return in_array($currency, ['KES', 'GHS', 'UGX', 'TZS', 'RWF', 'XOF', 'XAF']);
        }

        if (in_array($currency, ['NGN', 'USD', 'EUR', 'GBP', 'KES', 'GHS', 'UGX', 'TZS', 'ZAR', 'RWF'])) {
            return true;
        }

        return false;
    }

    public function supportedCurrencies(): array
    {
        return ['NGN', 'USD', 'EUR', 'GBP', 'KES', 'GHS', 'UGX', 'TZS', 'ZAR', 'RWF'];
    }

    public function supportedCountries(): array
    {
        return ['NG', 'KE', 'GH', 'UG', 'TZ', 'ZA', 'RW', 'US', 'GB'];
    }
}
