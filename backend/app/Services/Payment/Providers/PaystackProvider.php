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

class PaystackProvider implements CollectionProviderInterface, PayoutProviderInterface, ProviderCapabilityInterface, ProviderWebhookInterface, RefundProviderInterface
{
    protected string $baseUrl;

    protected ?string $publicKey;

    protected ?string $secretKey;

    protected int $timeout;

    public function __construct()
    {
        $cfg = config('payments.providers.paystack', []);
        $this->baseUrl = rtrim((string) ($cfg['base_url'] ?? 'https://api.paystack.co'), '/');
        $this->publicKey = $cfg['public_key'] ?? null;
        $this->secretKey = $cfg['secret_key'] ?? null;
        $this->timeout = (int) ($cfg['timeout'] ?? 30);
    }

    public function providerCode(): string
    {
        return 'paystack';
    }

    public function providerName(): string
    {
        return 'Paystack';
    }

    public function isAvailable(): bool
    {
        return (bool) config('payments.providers.paystack.enabled', false)
            && ! empty($this->secretKey);
    }

    public function testConnection(): array
    {
        $startTime = hrtime(true);
        try {
            if (empty($this->secretKey)) {
                throw new ProviderUnavailableException('paystack', 'Paystack secret key is missing.');
            }

            // Ping Paystack balance endpoint to verify authentication
            $res = Http::withToken($this->secretKey)
                ->timeout($this->timeout)
                ->get("{$this->baseUrl}/balance");

            $latencyMs = (int) round((hrtime(true) - $startTime) / 1e6);

            if ($res->successful()) {
                return [
                    'healthy' => true,
                    'latency_ms' => $latencyMs,
                    'message' => 'Paystack API authentication verified successfully.',
                ];
            }

            return [
                'healthy' => false,
                'latency_ms' => $latencyMs,
                'message' => 'Paystack API returned error: '.($res->json('message') ?? $res->body()),
            ];
        } catch (Exception $e) {
            $latencyMs = (int) round((hrtime(true) - $startTime) / 1e6);

            return [
                'healthy' => false,
                'latency_ms' => $latencyMs,
                'message' => 'Paystack connection error: '.$e->getMessage(),
            ];
        }
    }

    /**
     * Initialize Transaction (POST /transaction/initialize).
     */
    public function createPaymentIntent(PaymentIntentRequest $request): PaymentIntentResponse
    {
        if (empty($this->secretKey)) {
            throw new ProviderUnavailableException('paystack', 'Paystack secret key is missing.');
        }

        $payload = [
            'email' => $request->customerEmail,
            'amount' => $request->amount, // Paystack expects integer minor units (kobo, cents)
            'currency' => strtoupper($request->currency),
            'reference' => $request->publicReference,
            'callback_url' => $request->returnUrl,
            'metadata' => array_merge($request->metadata, [
                'internal_reference' => $request->internalReference,
                'customer_name' => $request->customerName,
                'platform' => 'MurihSpace',
            ]),
        ];

        $res = Http::withToken($this->secretKey)
            ->timeout($this->timeout)
            ->post("{$this->baseUrl}/transaction/initialize", $payload);

        if (! $res->successful() || ! $res->json('status')) {
            Log::error('Paystack initialize transaction failed', ['status' => $res->status(), 'body' => $res->json()]);
            throw new PaymentException(
                'Paystack payment initialization failed: '.($res->json('message') ?? $res->body()),
                'PAYSTACK_INITIALIZE_FAILED',
                $res->status()
            );
        }

        $data = $res->json('data') ?? [];
        $authorizationUrl = $data['authorization_url'] ?? '';
        $reference = $data['reference'] ?? $request->publicReference;
        $accessCode = $data['access_code'] ?? null;

        return new PaymentIntentResponse(
            provider: 'paystack',
            providerReference: $reference,
            providerTransactionId: $accessCode,
            redirectUrl: $authorizationUrl,
            clientSecret: $accessCode,
            metadata: $data,
            rawResponse: $res->json() ?? [],
        );
    }

    /**
     * Verify Transaction (GET /transaction/verify/{reference}).
     */
    public function verifyPayment(string $reference, array $context = []): PaymentVerificationResult
    {
        if (empty($this->secretKey)) {
            throw new ProviderUnavailableException('paystack', 'Paystack secret key is missing.');
        }

        $res = Http::withToken($this->secretKey)
            ->timeout($this->timeout)
            ->get("{$this->baseUrl}/transaction/verify/{$reference}");

        if (! $res->successful()) {
            return new PaymentVerificationResult(
                isSuccessful: false,
                status: PaymentStatus::Failed,
                providerReference: $reference,
                failureReason: 'Paystack verification failed: '.($res->json('message') ?? $res->body()),
                rawResponse: $res->json() ?? [],
            );
        }

        $data = $res->json('data') ?? [];
        $rawStatus = strtolower((string) ($data['status'] ?? ''));
        $amountMinor = isset($data['amount']) ? (int) $data['amount'] : null;
        $currency = $data['currency'] ?? null;
        $transactionId = isset($data['id']) ? (string) $data['id'] : null;

        $status = match ($rawStatus) {
            'success' => PaymentStatus::Successful,
            'reversed' => PaymentStatus::Reversed,
            'abandoned' => PaymentStatus::Expired,
            'failed' => PaymentStatus::Failed,
            'ongoing', 'pending' => PaymentStatus::Pending,
            default => PaymentStatus::Failed,
        };

        return new PaymentVerificationResult(
            isSuccessful: $status === PaymentStatus::Successful,
            status: $status,
            providerReference: $reference,
            providerTransactionId: $transactionId,
            amount: $amountMinor,
            currency: $currency,
            failureReason: $data['gateway_response'] ?? null,
            rawResponse: $res->json() ?? [],
        );
    }

    /**
     * Initiate Payout via Paystack Transfers API:
     * 1. Check or create transfer recipient (POST /transferrecipient)
     * 2. Initiate transfer (POST /transfer)
     */
    public function initiatePayout(PayoutRequest $request): PayoutResponse
    {
        if (empty($this->secretKey)) {
            throw new ProviderUnavailableException('paystack', 'Paystack secret key is missing.');
        }

        try {
            // Step 1: Create Transfer Recipient
            $recipientPayload = [
                'type' => $request->destinationType === 'mobile_money' ? 'mobile_money' : 'nuban',
                'name' => $request->destinationDetails['account_name'] ?? '',
                'account_number' => $request->destinationDetails['account_number'] ?? '',
                'bank_code' => $request->destinationDetails['bank_code'] ?? '',
                'currency' => strtoupper($request->currency),
            ];

            $recipientRes = Http::withToken($this->secretKey)
                ->timeout($this->timeout)
                ->post("{$this->baseUrl}/transferrecipient", $recipientPayload);

            if (! $recipientRes->successful() || ! $recipientRes->json('status')) {
                throw new PaymentException('Paystack recipient creation failed: '.($recipientRes->json('message') ?? $recipientRes->body()));
            }

            $recipientCode = $recipientRes->json('data.recipient_code');

            // Step 2: Initiate Transfer
            $transferPayload = [
                'source' => 'balance',
                'amount' => $request->amount,
                'recipient' => $recipientCode,
                'reason' => $request->narration,
                'reference' => $request->publicReference,
            ];

            $transferRes = Http::withToken($this->secretKey)
                ->timeout($this->timeout)
                ->post("{$this->baseUrl}/transfer", $transferPayload);

            if (! $transferRes->successful() || ! $transferRes->json('status')) {
                throw new PaymentException('Paystack transfer failed: '.($transferRes->json('message') ?? $transferRes->body()));
            }

            $transferData = $transferRes->json('data') ?? [];
            $transferCode = (string) ($transferData['transfer_code'] ?? $transferData['id'] ?? '');
            $rawStatus = strtolower((string) ($transferData['status'] ?? 'pending'));

            $status = match ($rawStatus) {
                'success' => PayoutStatus::Successful,
                'reversed', 'failed' => PayoutStatus::Failed,
                default => PayoutStatus::Processing,
            };

            return new PayoutResponse(
                provider: 'paystack',
                providerPayoutId: $transferCode,
                providerReference: $request->publicReference,
                status: $status,
                rawResponse: $transferRes->json() ?? [],
            );
        } catch (Exception $e) {
            Log::error('Paystack payout error', ['error' => $e->getMessage()]);

            return new PayoutResponse(
                provider: 'paystack',
                providerPayoutId: '',
                providerReference: $request->publicReference,
                status: PayoutStatus::Failed,
                failureReason: $e->getMessage(),
            );
        }
    }

    public function verifyPayout(string $providerPayoutId): array
    {
        $res = Http::withToken($this->secretKey)->get("{$this->baseUrl}/transfer/verify/{$providerPayoutId}");
        if (! $res->successful()) {
            return ['status' => 'failed', 'raw' => $res->json() ?? []];
        }

        $rawStatus = strtolower((string) $res->json('data.status'));
        $status = match ($rawStatus) {
            'success' => 'successful',
            'reversed', 'failed' => 'failed',
            default => 'processing',
        };

        return ['status' => $status, 'raw' => $res->json() ?? []];
    }

    /**
     * Process Refund (POST /refund).
     */
    public function processRefund(RefundRequest $request): RefundResponse
    {
        if (empty($this->secretKey)) {
            throw new ProviderUnavailableException('paystack', 'Paystack secret key is missing.');
        }

        $payload = [
            'transaction' => $request->paymentReference,
            'amount' => $request->amount,
            'currency' => strtoupper($request->currency),
            'merchant_note' => $request->reason,
        ];

        $res = Http::withToken($this->secretKey)
            ->timeout($this->timeout)
            ->post("{$this->baseUrl}/refund", $payload);

        if (! $res->successful() || ! $res->json('status')) {
            return new RefundResponse(
                provider: 'paystack',
                providerRefundId: '',
                status: RefundStatus::Failed,
                failureReason: $res->json('message') ?? $res->body(),
                rawResponse: $res->json() ?? [],
            );
        }

        $data = $res->json('data') ?? [];
        $refundId = (string) ($data['id'] ?? '');

        return new RefundResponse(
            provider: 'paystack',
            providerRefundId: $refundId,
            status: RefundStatus::Processing,
            rawResponse: $res->json() ?? [],
        );
    }

    /**
     * Webhook Signature Verification:
     * Paystack sends `x-paystack-signature` header which is HMAC-SHA512 of request raw content.
     */
    public function verifyWebhookSignature(Request $request): bool
    {
        if (empty($this->secretKey)) {
            Log::warning('Paystack secret key missing for webhook verification.');

            return false;
        }

        $signature = $request->header('x-paystack-signature');
        $rawContent = $request->getContent();

        if (empty($signature) || empty($rawContent)) {
            return false;
        }

        $computed = hash_hmac('sha512', $rawContent, $this->secretKey);

        return hash_equals($computed, $signature);
    }

    public function parseWebhookEvent(Request $request): NormalizedWebhookEvent
    {
        $payload = $request->json()->all();
        $event = (string) ($payload['event'] ?? '');
        $data = $payload['data'] ?? [];

        $eventId = (string) ($data['id'] ?? ('pstk_'.md5($request->getContent())));
        $reference = (string) ($data['reference'] ?? '');
        $amount = isset($data['amount']) ? (int) $data['amount'] : null;
        $currency = $data['currency'] ?? null;

        $status = match ($event) {
            'charge.success', 'transfer.success' => 'successful',
            'transfer.failed', 'transfer.reversed' => 'failed',
            'refund.processed' => 'refunded',
            'refund.failed' => 'failed',
            default => 'processing',
        };

        return new NormalizedWebhookEvent(
            provider: 'paystack',
            eventId: $eventId,
            eventType: $event,
            resourceReference: $reference,
            status: $status,
            amount: $amount,
            currency: $currency,
            payload: $payload,
            timestamp: (string) ($data['paid_at'] ?? now()->toISOString()),
        );
    }

    public function supports(string $capability, string $currency, ?string $country = null): bool
    {
        $currency = strtoupper($currency);
        $country = $country ? strtoupper($country) : null;

        if ($capability === 'mobile_money') {
            return in_array($currency, ['GHS', 'KES']);
        }

        if (in_array($currency, ['NGN', 'GHS', 'ZAR', 'KES', 'USD'])) {
            return true;
        }

        return false;
    }

    public function supportedCurrencies(): array
    {
        return ['NGN', 'GHS', 'ZAR', 'KES', 'USD'];
    }

    public function supportedCountries(): array
    {
        return ['NG', 'GH', 'ZA', 'KE'];
    }
}
