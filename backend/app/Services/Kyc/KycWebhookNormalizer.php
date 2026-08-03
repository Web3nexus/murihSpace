<?php

namespace App\Services\Kyc;

/**
 * Normalizes provider webhook payloads into a common shape.
 *
 * Shared by KycService::recordWebhook() (audit + idempotency) and
 * ProcessKycWebhook::toWebhook() (decision application) so both stages
 * extract the same session/event ids and derive the same status.
 */
class KycWebhookNormalizer
{
    /**
     * @return array{event_id: string, session_id: string, type: string, status: string}
     */
    public static function normalize(array $payload): array
    {
        $eventId = (string) ($payload['event_id'] ?? $payload['eventId'] ?? $payload['id'] ?? '');
        $sessionId = (string) ($payload['session_id'] ?? $payload['sessionId'] ?? $payload['object_id'] ?? $payload['applicantId'] ?? '');
        $type = (string) ($payload['webhook_type'] ?? $payload['type'] ?? $payload['event_type'] ?? '');

        $rawStatus = strtoupper((string) ($payload['reviewResult']['reviewAnswer']
            ?? $payload['status']
            ?? $payload['verification_status']
            ?? $payload['decision']
            ?? ''));

        $status = self::mapStatus($rawStatus);

        return [
            'event_id' => $eventId,
            'session_id' => $sessionId,
            'type' => $type,
            'status' => $status,
        ];
    }

    /**
     * Map a raw provider status/answer to a canonical platform status.
     *
     * Sumsub: reviewResult.reviewAnswer only carries GREEN (approved) or RED
     * (rejected). FINAL is a reviewRejectType marking a permanent rejection,
     * never an approval — it must not grant access.
     */
    public static function mapStatus(string $rawStatus): string
    {
        if ($rawStatus === '') {
            return '';
        }

        if (in_array($rawStatus, ['GREEN'], true) || in_array(strtolower($rawStatus), ['verified', 'approved', 'passed'], true)) {
            return 'approved';
        }

        if (in_array($rawStatus, ['RED', 'FINAL'], true) || in_array(strtolower($rawStatus), ['rejected', 'failed', 'declined', 'denied', 'expired'], true)) {
            return 'rejected';
        }

        return $rawStatus;
    }
}
