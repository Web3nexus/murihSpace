<?php

namespace App\Services\Payment;

use App\Enums\PayoutStatus;
use App\Models\IdempotencyKey;
use App\Models\Payout;
use App\Models\PayoutDestination;
use App\Services\Payment\Contracts\PayoutProviderInterface;
use App\Services\Payment\DTO\PayoutRequest;
use App\Services\Payment\Exceptions\PaymentException;
use App\Services\Payment\Router\ProviderRouter;
use App\Services\Wallet\LedgerService;
use Exception;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class PayoutService
{
    public function __construct(
        protected ProviderRouter $router,
        protected LedgerService $ledgerService
    ) {}

    /**
     * Dispatches a creator/user payout request.
     *
     * @param array{
     *     user_id: int,
     *     amount: int, // Minor units
     *     currency: string,
     *     payout_destination_id: int,
     *     idempotency_key: string,
     *     narration?: string
     * } $data
     */
    public function createPayout(array $data): array
    {
        $idempotencyKey = $data['idempotency_key'] ?? (string) Str::uuid();

        // 1. Idempotency Check
        $existing = IdempotencyKey::where('key', $idempotencyKey)
            ->where('scope', 'payout_create')
            ->first();

        if ($existing && $existing->response_body) {
            return $existing->response_body;
        }

        $destination = PayoutDestination::where('id', $data['payout_destination_id'])
            ->where('user_id', $data['user_id'])
            ->firstOrFail();

        $amount = (int) $data['amount'];
        $currency = strtoupper($data['currency']);
        $country = $destination->country_code;

        // 2. Resolve Payout Provider
        $provider = $this->router->resolve(
            transactionType: 'payout',
            currency: $currency,
            country: $country,
            paymentMethod: $destination->destination_type,
            amount: $amount
        );

        if (! ($provider instanceof PayoutProviderInterface)) {
            throw new PaymentException("Resolved provider '{$provider->providerCode()}' does not support payouts.");
        }

        // 3. Create Internal Payout Record
        $payout = DB::transaction(function () use ($data, $amount, $currency, $destination, $provider, $idempotencyKey) {
            return Payout::create([
                'user_id' => $data['user_id'],
                'payout_destination_id' => $destination->id,
                'amount' => $amount,
                'currency' => $currency,
                'net_amount' => $amount,
                'provider' => $provider->providerCode(),
                'status' => PayoutStatus::Pending,
                'idempotency_key' => $idempotencyKey,
            ]);
        });

        // 4. Dispatch Provider Payout
        $req = new PayoutRequest(
            internalReference: $payout->internal_reference,
            publicReference: $payout->public_reference,
            amount: $amount,
            currency: $currency,
            destinationType: $destination->destination_type,
            destinationDetails: array_merge($destination->details_encrypted ?? [], [
                'account_number' => $destination->account_number_masked,
                'account_name' => $destination->account_name,
                'bank_code' => $destination->bank_code,
            ]),
            idempotencyKey: $idempotencyKey,
            narration: $data['narration'] ?? 'MurihSpace Creator Earnings Payout'
        );

        try {
            $payoutRes = $provider->initiatePayout($req);

            $payout->update([
                'provider_payout_id' => $payoutRes->providerPayoutId,
                'provider_reference' => $payoutRes->providerReference,
                'status' => $payoutRes->status,
                'fee_amount' => $payoutRes->feeAmount,
                'net_amount' => max(0, $amount - $payoutRes->feeAmount),
                'dispatched_at' => now(),
            ]);

            // If immediate success, mark completed and record ledger debit
            if ($payoutRes->status === PayoutStatus::Successful) {
                $payout->update(['completed_at' => now()]);
                $this->ledgerService->recordTransaction(
                    type: 'withdrawal',
                    amount: $payout->amount,
                    currency: $payout->currency,
                    description: "Payout withdrawal [Ref: {$payout->public_reference}]",
                    metadata: ['payout_id' => $payout->id, 'provider' => $provider->providerCode()],
                    initiatedBy: $payout->user_id
                );
            }

            $responsePayload = [
                'success' => true,
                'payout_id' => $payout->id,
                'public_reference' => $payout->public_reference,
                'status' => $payout->status->value,
                'amount' => $payout->amount,
                'currency' => $payout->currency,
            ];

            IdempotencyKey::create([
                'key' => $idempotencyKey,
                'scope' => 'payout_create',
                'user_id' => $data['user_id'],
                'request_hash' => hash('sha256', json_encode($data)),
                'response_status' => 200,
                'response_body' => $responsePayload,
            ]);

            return $responsePayload;
        } catch (Exception $e) {
            $payout->update([
                'status' => PayoutStatus::Failed,
                'failure_reason' => $e->getMessage(),
            ]);

            throw $e;
        }
    }
}
