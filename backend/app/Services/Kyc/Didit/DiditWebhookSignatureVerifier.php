<?php

namespace App\Services\Kyc\Didit;

use App\Services\Kyc\KycCredentials;
use App\Services\Kyc\VerifiedKycWebhook;
use Illuminate\Support\Facades\Log;

class DiditWebhookSignatureVerifier
{
    private const MAX_AGE_SECONDS = 300;

    public function __construct(
        private readonly array $config = [],
    ) {}

    private function cfg(string $key): mixed
    {
        if (array_key_exists($key, $this->config)) {
            return $this->config[$key];
        }

        return KycCredentials::resolve('didit', $key, config("kyc.didit.{$key}"));
    }

    /**
     * Verify a Didit webhook request. Returns the normalised event when valid.
     */
    public function verify(string $payload, array $headers): ?VerifiedKycWebhook
    {
        $data = json_decode($payload, true);

        if (! is_array($data)) {
            Log::warning('Didit webhook: invalid JSON payload');
            return null;
        }

        $eventId = (string) ($data['event_id'] ?? $data['eventId'] ?? '');
        $sessionId = (string) ($data['session_id'] ?? $data['sessionId'] ?? $data['object_id'] ?? '');
        $webhookType = (string) ($data['webhook_type'] ?? $data['type'] ?? $data['event_type'] ?? '');
        $status = (string) ($data['status'] ?? $data['verification_status'] ?? $data['decision'] ?? '');

        if ($sessionId === '' || $webhookType === '') {
            Log::warning('Didit webhook: missing session/type', ['event_id' => $eventId]);
            return null;
        }

        if (! $this->hasValidSignature($payload, $data, $headers)) {
            Log::warning('Didit webhook: invalid signature', ['event_id' => $eventId, 'session_id' => $sessionId]);
            return null;
        }

        return new VerifiedKycWebhook(
            eventId: $eventId,
            sessionId: $sessionId,
            status: $status,
            webhookType: $webhookType,
            payload: $data,
        );
    }

    private function hasValidSignature(string $payload, array $data, array $headers): bool
    {
        $secret = (string) $this->cfg('webhook_secret');
        if ($secret === '') {
            Log::warning('Didit webhook: webhook_secret not configured');
            return false;
        }

        $get = function (string $name) use ($headers): ?string {
            foreach ($headers as $k => $v) {
                if (strcasecmp((string) $k, $name) === 0) {
                    return is_array($v) ? implode(', ', $v) : (string) $v;
                }
            }

            return null;
        };

        // 1) Timestamp replay protection (tolerated by Simple signature and v2/v1 headers).
        $timestamp = (int) ($data['timestamp'] ?? $data['created_at'] ?? 0);
        if ($timestamp > 0 && abs(time() - $timestamp) > self::MAX_AGE_SECONDS) {
            Log::warning('Didit webhook: stale timestamp', ['timestamp' => $timestamp]);
            return false;
        }

        // 2) Prefer X-Signature-Simple: "{timestamp}:{session_id}:{status}:{webhook_type}"
        $simple = $get('x-signature-simple');
        if ($simple !== null) {
            [$ts, $session, $status, $type] = array_pad(explode(':', $simple, 4), 4, '');

            if (abs(time() - (int) $ts) > self::MAX_AGE_SECONDS) {
                return false;
            }

            $expected = hash_hmac('sha256', "{$ts}:{$session}:{$status}:{$type}", $secret);
            if (hash_equals($expected, (string) $simple)) {
                return true;
            }
        }

        // 3) X-Signature-V2: HMAC over sorted compact JSON (Unicode preserved, ensure_ascii=false)
        $sigV2 = $get('x-signature-v2');
        if ($sigV2 !== null) {
            $canonical = $this->canonicalJson($data, preserveUnicode: true);
            $expected = hash_hmac('sha256', $canonical, $secret);
            if (hash_equals($expected, strtolower($sigV2))) {
                return true;
            }
        }

        // 4) X-Signature (raw): HMAC over the exact raw bytes as transmitted
        $sigRaw = $get('x-signature');
        if ($sigRaw !== null) {
            $expected = hash_hmac('sha256', $payload, $secret);
            if (hash_equals($expected, strtolower($sigRaw))) {
                return true;
            }
        }

        return false;
    }

    /**
     * Build the canonical compact JSON used by Didit for X-Signature-V2.
     * Keys sorted recursively; unicode preserved (ensure_ascii=false); float precision trimmed.
     *
     * @param  array<string, mixed>  $data
     */
    private function canonicalJson(array $data, bool $preserveUnicode): string
    {
        $json = json_encode(
            $data,
            JSON_UNESCAPED_SLASHES
                | JSON_UNESCAPED_UNICODE
                | JSON_PRESERVE_ZERO_FRACTION,
        );

        return $preserveUnicode
            ? $json
            : json_encode(json_decode($json, true), JSON_UNESCAPED_SLASHES | JSON_PRESERVE_ZERO_FRACTION);
    }
}
