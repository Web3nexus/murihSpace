<?php

namespace App\Services\MurihSpace;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

/**
 * Server-to-server client for the main MurihSpace backend's ads SSO exchange.
 *
 * Contract (verified against backend/app/Http/Controllers/AdsSsoController.php
 * and backend/routes/internal.php):
 *
 *   POST {sso_base_url}/internal/ads/sso/exchange
 *     Headers: X-Internal-Token, X-Timestamp (unix seconds, within 300 s),
 *              X-Nonce (16-128 chars, never reused)
 *     Body:    { "code": "...", "redirect_uri": "..." }   (redirect_uri must match exactly)
 *     200:     { "status": "success", "data": { "user": { "id", "name", "username",
 *                "avatar_url" }, "sync": { "status", "key" } } }
 *     401 invalid_code | 422 redirect_mismatch | 403 ads_upgrade_required | 403 bad token
 *
 * The exchange never returns email or phone. The code itself is obtained by the
 * browser from POST {main api}/api/v1/ads/sso/code, not by this service.
 *
 * Every failure is raised as MurihSpaceSsoException with a machine-readable reason.
 */
class MurihSpaceSsoClient
{
    /**
     * @return array{murihspace_user_id:int, name:string, username:?string, avatar_url:?string}
     *
     * @throws MurihSpaceSsoException
     */
    public function exchangeCode(string $code): array
    {
        $base = $this->baseUrl();
        $redirectUri = $this->redirectUri();
        $token = $this->internalToken();

        try {
            $response = Http::acceptJson()
                ->withHeaders([
                    'X-Internal-Token' => $token,
                    'X-Timestamp' => (string) time(),
                    'X-Nonce' => Str::random(40),
                ])
                ->timeout(10)
                ->post($base.'/internal/ads/sso/exchange', [
                    'code' => $code,
                    'redirect_uri' => $redirectUri,
                ]);
        } catch (ConnectionException) {
            throw new MurihSpaceSsoException('sso_unavailable');
        }

        $errorCode = $response->json('code') ?? $response->json('errors.code');

        if ($response->status() === 401) {
            throw new MurihSpaceSsoException('invalid_code');
        }

        if ($response->status() === 422 && $errorCode === 'redirect_mismatch') {
            throw new MurihSpaceSsoException('redirect_mismatch');
        }

        if ($response->status() === 403) {
            throw new MurihSpaceSsoException(
                $errorCode === 'ads_upgrade_required' ? 'ads_upgrade_required' : 'internal_auth_failed'
            );
        }

        if (! $response->successful() || $response->json('status') !== 'success') {
            throw new MurihSpaceSsoException('exchange_failed');
        }

        $user = $response->json('data.user');
        $id = is_array($user) ? ($user['id'] ?? null) : null;

        if (! is_int($id) || $id <= 0) {
            throw new MurihSpaceSsoException('invalid_profile');
        }

        return [
            'murihspace_user_id' => $id,
            'name' => is_string($user['name'] ?? null) && $user['name'] !== '' ? $user['name'] : 'Advertiser',
            'username' => is_string($user['username'] ?? null) && $user['username'] !== '' ? $user['username'] : null,
            'avatar_url' => is_string($user['avatar_url'] ?? null) ? $user['avatar_url'] : null,
        ];
    }

    private function baseUrl(): string
    {
        $base = rtrim((string) config('services.murihspace.sso_base_url'), '/');
        if ($base === '') {
            throw new MurihSpaceSsoException('sso_not_configured');
        }

        return $base;
    }

    private function redirectUri(): string
    {
        $uri = (string) config('services.murihspace.redirect_uri');
        if ($uri === '') {
            throw new MurihSpaceSsoException('sso_not_configured');
        }

        return $uri;
    }

    private function internalToken(): string
    {
        $token = (string) config('services.murihspace.internal_token');
        if ($token === '') {
            throw new MurihSpaceSsoException('sso_not_configured');
        }

        return $token;
    }
}
