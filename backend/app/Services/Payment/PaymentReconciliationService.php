<?php

namespace App\Services\Payment;

use App\Enums\PaymentStatus;
use App\Models\Payment;
use App\Models\ReconciliationRecord;
use App\Services\Payment\Contracts\CollectionProviderInterface;
use App\Services\Payment\Router\ProviderRouter;
use Carbon\Carbon;
use Exception;
use Illuminate\Support\Facades\Log;

class PaymentReconciliationService
{
    public function __construct(
        protected ProviderRouter $router
    ) {}

    /**
     * Run daily reconciliation for a specified date across all providers.
     */
    public function reconcileDate(Carbon $date): array
    {
        $startDate = $date->copy()->startOfDay();
        $endDate = $date->copy()->endOfDay();

        $payments = Payment::whereBetween('created_at', [$startDate, $endDate])->get();

        $matchedCount = 0;
        $mismatchCount = 0;
        $unmatchedCount = 0;

        foreach ($payments as $payment) {
            try {
                $providerInstance = $this->router->getProvider($payment->provider);

                if (! ($providerInstance instanceof CollectionProviderInterface)) {
                    continue;
                }

                $referenceToVerify = $payment->provider_transaction_id ?: $payment->provider_reference ?: $payment->public_reference;
                $verification = $providerInstance->verifyPayment($referenceToVerify);

                $discrepancy = 'none';
                $resStatus = 'matched';
                $notes = null;

                if (! $verification->isSuccessful && $payment->status === PaymentStatus::Successful) {
                    $discrepancy = 'status_mismatch';
                    $resStatus = 'mismatch';
                    $notes = "Internal status is successful, but provider returned: {$verification->status->value}";
                    $mismatchCount++;
                } elseif ($verification->isSuccessful && $payment->status !== PaymentStatus::Successful) {
                    $discrepancy = 'missing_webhook';
                    $resStatus = 'investigation';
                    $notes = "Provider confirmed payment as successful, but internal status is still {$payment->status->value} (possible dropped webhook).";
                    $mismatchCount++;
                } elseif ($verification->amount !== null && $verification->amount !== $payment->amount) {
                    $discrepancy = 'amount_mismatch';
                    $resStatus = 'mismatch';
                    $notes = "Amount mismatch: internal {$payment->amount} vs provider {$verification->amount}";
                    $mismatchCount++;
                } elseif ($verification->currency !== null && strtoupper($verification->currency) !== strtoupper($payment->currency)) {
                    $discrepancy = 'amount_mismatch';
                    $resStatus = 'mismatch';
                    $notes = "Currency mismatch: internal {$payment->currency} vs provider {$verification->currency}";
                    $mismatchCount++;
                } else {
                    $matchedCount++;
                }

                ReconciliationRecord::updateOrCreate(
                    [
                        'reconciliation_date' => $date->toDateString(),
                        'provider' => $payment->provider,
                        'payment_id' => $payment->id,
                    ],
                    [
                        'provider_transaction_id' => $verification->providerTransactionId ?? $payment->provider_transaction_id,
                        'internal_amount' => $payment->amount,
                        'provider_amount' => $verification->amount ?? $payment->amount,
                        'internal_currency' => $payment->currency,
                        'provider_currency' => $verification->currency ?? $payment->currency,
                        'internal_status' => $payment->status->value,
                        'provider_status' => $verification->status->value,
                        'discrepancy_type' => $discrepancy,
                        'resolution_status' => $resStatus,
                        'notes' => $notes,
                    ]
                );
            } catch (Exception $e) {
                Log::warning("Reconciliation check failed for payment {$payment->public_reference}: {$e->getMessage()}");
                $unmatchedCount++;

                ReconciliationRecord::updateOrCreate(
                    [
                        'reconciliation_date' => $date->toDateString(),
                        'provider' => $payment->provider,
                        'payment_id' => $payment->id,
                    ],
                    [
                        'internal_amount' => $payment->amount,
                        'internal_currency' => $payment->currency,
                        'internal_status' => $payment->status->value,
                        'discrepancy_type' => 'missing_provider',
                        'resolution_status' => 'unmatched',
                        'notes' => 'Unable to verify with provider API: '.$e->getMessage(),
                    ]
                );
            }
        }

        return [
            'date' => $date->toDateString(),
            'total_scanned' => $payments->count(),
            'matched' => $matchedCount,
            'mismatches' => $mismatchCount,
            'unmatched' => $unmatchedCount,
        ];
    }
}
