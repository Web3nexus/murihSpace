<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Pure-HTTP FCM v1 sender.
 * No kreait/laravel-firebase dependency — works with any Laravel installation
 * that has Guzzle (always available via illuminate/http).
 *
 * Credentials are read from the service account JSON file at:
 *   storage/app/firebase-auth.json  (path configurable via FIREBASE_CREDENTIALS env)
 */
class FcmService
{
    private const FCM_BASE = 'https://fcm.googleapis.com/v1/projects';
    private const OAUTH_URL = 'https://oauth2.googleapis.com/token';
    private const CACHE_KEY = 'firebase_oauth_token';

    /** Send a notification + data payload to a single FCM device token. */
    public static function sendToToken(
        string $token,
        string $title,
        string $body,
        array $data = [],
        bool $highPriority = true
    ): bool {
        try {
            $accessToken = self::getAccessToken();
            $projectId   = self::getProjectId();

            $payload = [
                'message' => [
                    'token'        => $token,
                    'notification' => [
                        'title' => $title,
                        'body'  => $body,
                    ],
                    'data'         => array_map('strval', $data),
                    'android'      => [
                        'priority'     => $highPriority ? 'high' : 'normal',
                        'notification' => [
                            'channel_id'  => 'murihspace_chat',
                            'sound'       => 'default',
                            'click_action' => 'FLUTTER_NOTIFICATION_CLICK',
                        ],
                    ],
                    'apns' => [
                        'headers' => [
                            'apns-priority' => $highPriority ? '10' : '5',
                        ],
                        'payload' => [
                            'aps' => [
                                'alert' => [
                                    'title' => $title,
                                    'body'  => $body,
                                ],
                                'sound'           => 'default',
                                'badge'           => 1,
                                'mutable-content' => 1,
                            ],
                        ],
                    ],
                ],
            ];

            $response = Http::withToken($accessToken)
                ->timeout(10)
                ->post(self::FCM_BASE . "/{$projectId}/messages:send", $payload);

            if ($response->failed()) {
                Log::error('[FCM] Send failed', [
                    'status' => $response->status(),
                    'body'   => $response->body(),
                    'token_preview' => substr($token, 0, 20) . '...',
                ]);
                return false;
            }

            Log::debug('[FCM] Message sent', ['message_id' => $response->json('name')]);
            return true;

        } catch (\Throwable $e) {
            Log::error('[FCM] Exception: ' . $e->getMessage());
            return false;
        }
    }

    /** Send a pure data message (no notification block) for background wakeup (e.g. calls). */
    public static function sendDataToToken(
        string $token,
        array $data,
        bool $highPriority = true
    ): bool {
        try {
            $accessToken = self::getAccessToken();
            $projectId   = self::getProjectId();

            $payload = [
                'message' => [
                    'token' => $token,
                    'data'  => array_map('strval', $data),
                    'android' => [
                        'priority' => $highPriority ? 'high' : 'normal',
                    ],
                    'apns' => [
                        'headers' => [
                            'apns-priority'  => $highPriority ? '10' : '5',
                            'apns-push-type' => 'background',
                        ],
                        'payload' => [
                            'aps' => [
                                'content-available' => 1,
                            ],
                        ],
                    ],
                ],
            ];

            $response = Http::withToken($accessToken)
                ->timeout(10)
                ->post(self::FCM_BASE . "/{$projectId}/messages:send", $payload);

            if ($response->failed()) {
                Log::error('[FCM] Data send failed', [
                    'status' => $response->status(),
                    'body'   => $response->body(),
                ]);
                return false;
            }

            return true;

        } catch (\Throwable $e) {
            Log::error('[FCM] Exception (data): ' . $e->getMessage());
            return false;
        }
    }

    /**
     * Fan-out a notification to every known device token for a user
     * (legacy users.fcm_token + all native entries in push_tokens).
     * This is what makes delivery reliable when the user is signed in on
     * more than one device at the same time.
     *
     * @return int number of tokens the message was dispatched to
     */
    public static function sendToUser(
        int $userId,
        string $title,
        string $body,
        array $data = [],
        bool $highPriority = true
    ): int {
        $tokens = self::deviceTokensForUser($userId);
        foreach ($tokens as $token) {
            self::sendToToken($token, $title, $body, $data, $highPriority);
        }
        return count($tokens);
    }

    /**
     * Fan-out a pure data message (background wakeup, e.g. incoming calls)
     * to every known device token for a user.
     *
     * @return int number of tokens the message was dispatched to
     */
    public static function sendDataToUser(
        int $userId,
        array $data,
        bool $highPriority = true
    ): int {
        $tokens = self::deviceTokensForUser($userId);
        foreach ($tokens as $token) {
            self::sendDataToToken($token, $data, $highPriority);
        }
        return count($tokens);
    }

    /** Collect and de-duplicate every deliverable FCM token for a user. */
    private static function deviceTokensForUser(int $userId): array
    {
        $tokens = [];

        $primary = \App\Models\User::whereKey($userId)->value('fcm_token');
        if (!empty($primary)) {
            $tokens[] = $primary;
        }

        $registered = \App\Models\PushToken::where('user_id', $userId)
            ->whereIn('platform', ['ios', 'android'])
            ->pluck('token')
            ->all();

        foreach ($registered as $token) {
            if (!empty($token)) {
                $tokens[] = $token;
            }
        }

        return array_values(array_unique($tokens));
    }

    /**
     * Send a PushKit VoIP push to every iOS device registered for the user.
     * APNs allows VoIP pushes to wake a terminated app so it can ring via
     * CallKit — this is the only reliable way to ring an iPhone whose app
     * has been swiped away.
     *
     * @return int number of VoIP tokens the message was dispatched to
     */
    public static function sendVoipToUser(int $userId, array $data, bool $highPriority = true): int
    {
        $tokens = self::voipTokensForUser($userId);
        $topic  = (string) config('services.apns.voip_topic', 'com.murihspace.mobile.voip');

        foreach ($tokens as $token) {
            self::sendVoipToToken($token, $data, $topic, $highPriority);
        }

        return count($tokens);
    }

    private static function voipTokensForUser(int $userId): array
    {
        return \App\Models\PushToken::where('user_id', $userId)
            ->where('platform', 'ios_voip')
            ->pluck('token')
            ->filter()
            ->values()
            ->all();
    }

    /**
     * Deliver a PushKit VoIP push straight to APNs.
     *
     * FCM's token-based endpoint only accepts FCM registration tokens — a raw
     * PushKit token is an APNs device token and must be sent to
     * api.push.apple.com with the `.voip` topic and `apns-push-type: voip`.
     * Anything else silently fails to ring a terminated iOS app.
     */
    private static function sendVoipToToken(string $token, array $data, string $topic, bool $highPriority = true): bool
    {
        try {
            $jwt = self::getApnsJwt();
            if ($jwt === null) {
                Log::warning('[APNs] VoIP push skipped — APNs credentials not configured (set APNS_KEY_ID, APNS_TEAM_ID and APNS_KEY_PATH).');
                return false;
            }

            // Custom keys ride at the top level for PushKit; CallKit reads them
            // directly. `aps` carries content-available so the payload is valid.
            $payload = array_map('strval', $data);
            $payload['aps'] = ['content-available' => 1];

            $response = Http::withOptions(['version' => 2.0])
                ->asJson()
                ->withHeaders([
                    'authorization'   => 'bearer ' . $jwt,
                    'apns-topic'      => $topic,
                    'apns-push-type'  => 'voip',
                    'apns-priority'   => $highPriority ? '10' : '5',
                    'apns-expiration' => (string) (time() + 30),
                ])
                ->timeout(10)
                ->post(self::apnsHost() . '/3/device/' . $token, $payload);

            if ($response->failed()) {
                Log::error('[APNs] VoIP send failed', [
                    'status' => $response->status(),
                    'body'   => $response->body(),
                ]);

                // 410 Gone always means the token is stale. 400 is only a bad
                // token when APNs says so (`reason: BadDeviceToken`); other 400s
                // (BadTopic, PayloadTooLarge, ...) must keep the token intact.
                $isStale = $response->status() === 410
                    || ($response->status() === 400 && $response->json('reason') === 'BadDeviceToken');

                if ($isStale) {
                    \App\Models\PushToken::where('token', $token)
                        ->where('platform', 'ios_voip')
                        ->delete();
                }

                return false;
            }

            return true;

        } catch (\Throwable $e) {
            Log::error('[APNs] Exception (VoIP): ' . $e->getMessage());
            return false;
        }
    }

    /**
     * Mint (and cache) the provider authentication token APNs expects: an ES256
     * JWT whose header carries the key id and whose issuer is the team id.
     */
    private static function getApnsJwt(): ?string
    {
        $keyId   = (string) config('services.apns.key_id');
        $teamId  = (string) config('services.apns.team_id');
        $keyPath = (string) config('services.apns.key_path');

        if ($keyPath === '' && $keyId !== '') {
            $keyPath = storage_path('app/AuthKey_' . $keyId . '.p8');
        }

        if ($keyId === '' || $teamId === '' || ! is_file($keyPath)) {
            return null;
        }

        return Cache::remember('apns_jwt_' . $keyId, now()->addMinutes(50), function () use ($keyId, $teamId, $keyPath) {
            return \Firebase\JWT\JWT::encode(
                ['iss' => $teamId, 'iat' => time()],
                file_get_contents($keyPath),
                'ES256',
                $keyId
            );
        });
    }

    private static function apnsHost(): string
    {
        $env = strtolower((string) config('services.apns.environment', 'production'));

        return in_array($env, ['sandbox', 'development', 'dev'], true)
            ? 'https://api.sandbox.push.apple.com'
            : 'https://api.push.apple.com';
    }

    // ─── Internal helpers ────────────────────────────────────────────────────

    private static function getProjectId(): string
    {
        $creds = self::loadCredentials();
        return $creds['project_id'] ?? throw new \RuntimeException('Firebase project_id not found in credentials file.');
    }

    /**
     * Mint a short-lived OAuth2 access token using the service account.
     * Cached for 55 minutes (tokens expire in 60).
     */
    private static function getAccessToken(): string
    {
        return Cache::remember(self::CACHE_KEY, now()->addMinutes(55), function () {
            $creds = self::loadCredentials();

            $now = time();
            $header = base64url_encode(json_encode(['alg' => 'RS256', 'typ' => 'JWT']));
            $claim  = base64url_encode(json_encode([
                'iss'   => $creds['client_email'],
                'scope' => 'https://www.googleapis.com/auth/firebase.messaging',
                'aud'   => self::OAUTH_URL,
                'exp'   => $now + 3600,
                'iat'   => $now,
            ]));

            $toSign = $header . '.' . $claim;

            $privateKey = $creds['private_key'];
            openssl_sign($toSign, $signature, $privateKey, 'SHA256');
            $jwt = $toSign . '.' . base64url_encode($signature);

            $response = Http::asForm()->post(self::OAUTH_URL, [
                'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                'assertion'  => $jwt,
            ]);

            if ($response->failed()) {
                throw new \RuntimeException('Firebase OAuth token request failed: ' . $response->body());
            }

            return $response->json('access_token');
        });
    }

    private static function loadCredentials(): array
    {
        $path = env('FIREBASE_CREDENTIALS', storage_path('app/firebase-auth.json'));

        if (! file_exists($path)) {
            throw new \RuntimeException("Firebase credentials file not found at: {$path}");
        }

        return json_decode(file_get_contents($path), true);
    }
}

// Global helper: base64url encode without padding
if (! function_exists('base64url_encode')) {
    function base64url_encode(string $data): string
    {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }
}

