<?php

namespace App\Services\Payment;

/**
 * Maps a verified provider webhook payload to a settlement outcome.
 *
 * Only the event names listed here can move money. Anything else is ignored. Paystack's transfer and refund
 * payload shapes follow the Paystack documentation supplied by the user (see the Paystack methods below).
 */
class ProviderResultResolver
{
    /**
     * @return array{provider: string, event_type: string, outcome: string, reference: string, provider_ids: array<int, string>, raw: array}|null
     */
    public static function payout(string $provider, string $eventType, array $payload): ?array
    {
        $data = is_array($payload['data'] ?? null) ? $payload['data'] : [];

        switch ($provider) {
            case 'paystack':
                // Paystack: transfer.success | transfer.failed | transfer.reversed. The reference is the one we sent.
                $outcome = match ($eventType) {
                    'transfer.success' => 'successful',
                    'transfer.failed', 'transfer.reversed' => 'failed',
                    default => null,
                };

                return $outcome === null ? null : self::result(
                    $provider, $eventType, $outcome, (string) ($data['reference'] ?? ''),
                    [(string) ($data['transfer_code'] ?? ''), (string) ($data['id'] ?? '')], $payload,
                );

            case 'flutterwave':
                // Flutterwave: transfer.completed, branch on data.status (SUCCESSFUL / FAILED).
                if ($eventType !== 'transfer.completed') {
                    return null;
                }
                $outcome = match (strtoupper((string) ($data['status'] ?? ''))) {
                    'SUCCESSFUL' => 'successful',
                    'FAILED' => 'failed',
                    default => null,
                };

                return $outcome === null ? null : self::result(
                    $provider, $eventType, $outcome, (string) ($data['reference'] ?? ''),
                    [(string) ($data['id'] ?? '')], $payload,
                );

            case 'airwallex':
                // Airwallex current payout events. payout.transfer.paid = delivered to the beneficiary.
                // payout.transfer.sent is only "sent to our banking partner", so it does not settle.
                $outcome = match ($eventType) {
                    'payout.transfer.paid' => 'successful',
                    'payout.transfer.failed', 'payout.transfer.cancelled' => 'failed',
                    default => null,
                };
                $object = $payload['data']['object'] ?? $data;

                return $outcome === null ? null : self::result(
                    $provider, $eventType, $outcome, (string) ($object['request_id'] ?? ''),
                    [(string) ($object['id'] ?? '')], $payload,
                );
        }

        return null;
    }

    /**
     * A final refund result from a provider event. Paystack refund payloads carry no data.id and no data.reference:
     * they identify the refund by transaction_reference (the original charge), amount (string, minor units),
     * currency and refund_reference (null until processed). Matching is done by RefundService.
     *
     * refund.processing and refund.pending are not results. They return null, so they never settle anything.
     *
     * @return array{provider_refund_id: string, refund_reference: ?string, transaction_reference: string, amount: ?int, currency: ?string, outcome: string, event_type: string, raw: array}|null
     */
    public static function refund(string $provider, string $eventType, array $payload): ?array
    {
        if ($provider !== 'paystack') {
            return null;
        }

        $outcome = match ($eventType) {
            'refund.processed' => 'successful',
            'refund.failed' => 'failed',
            default => null,
        };
        if ($outcome === null) {
            return null;
        }

        $data = is_array($payload['data'] ?? null) ? $payload['data'] : [];
        $refundReference = isset($data['refund_reference']) && $data['refund_reference'] !== ''
            ? (string) $data['refund_reference']
            : null;
        $amount = isset($data['amount']) && is_numeric($data['amount']) ? (int) $data['amount'] : null;
        $currency = isset($data['currency']) && $data['currency'] !== '' ? strtoupper((string) $data['currency']) : null;

        return [
            // Not present in the documented Paystack refund payloads. Read only if a payload ever carries it.
            'provider_refund_id' => (string) ($data['id'] ?? ''),
            'refund_reference' => $refundReference,
            'transaction_reference' => (string) ($data['transaction_reference'] ?? ''),
            'amount' => $amount,
            'currency' => $currency,
            'outcome' => $outcome,
            'event_type' => $eventType,
            'raw' => $payload,
        ];
    }

    private static function result(string $provider, string $eventType, string $outcome, string $reference, array $ids, array $raw): array
    {
        return [
            'provider' => $provider,
            'event_type' => $eventType,
            'outcome' => $outcome,
            'reference' => $reference,
            'provider_ids' => array_values(array_filter($ids, fn ($id) => $id !== '')),
            'raw' => $raw,
        ];
    }
}
