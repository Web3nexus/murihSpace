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

