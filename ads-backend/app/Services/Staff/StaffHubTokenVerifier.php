<?php

namespace App\Services\Staff;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

/**
 * Verifies a staff token issued by the marketing hub.
 *
 * Token format (see the report / docs for the hub side):
 *   <payload>.<signature>
 *   payload   = base64url( UTF-8 JSON of the claims below ), no padding
 *   signature = lowercase hex HMAC-SHA256( key = ADS_STAFF_HUB_SECRET, message = <payload> )
 *
 * Claims (all required):
 *   v       int     must be 1
 *   typ     string  must be "ads-staff"
 *   sid     string  the hub staff id (1..64 chars)
 *   role    string  one of config('ads.staff_roles')
 *   status  string  must be "active"
 *   iat     int     issued-at, unix seconds (not more than 30s in the future)
 *   exp     int     expiry, unix seconds (must be in the future, exp - iat <= 300)
 *   jti     string  unique id, 16..128 chars of [A-Za-z0-9_-]; accepted once only
 */
class StaffHubTokenVerifier
{
    public const TOKEN_VERSION = 1;
    public const TOKEN_TYPE = 'ads-staff';
    public const MAX_LIFETIME_SECONDS = 300;
    private const CLOCK_SKEW_SECONDS = 30;

    /**
     * @return array{sid: string, role: string, jti: string, exp: int}
     *
     * @throws StaffHubTokenException
     */
    public function verify(string $token): array
    {
        $secret = (string) config('ads.staff_hub_secret');
        if ($secret === '') {
            Log::error('[ads-staff] ADS_STAFF_HUB_SECRET is not configured; staff sign-in is refused.');

            throw new StaffHubTokenException('staff_sign_in_unavailable');
        }

        $parts = explode('.', $token);
        if (count($parts) !== 2 || $parts[0] === '' || $parts[1] === '') {
            throw new StaffHubTokenException('invalid_staff_token');
        }
        [$encodedPayload, $signature] = $parts;

        $expected = hash_hmac('sha256', $encodedPayload, $secret);
        if (! hash_equals($expected, strtolower($signature))) {
            throw new StaffHubTokenException('invalid_staff_token');
        }

        $claims = json_decode((string) $this->base64UrlDecode($encodedPayload), true);
        if (! is_array($claims)) {
            throw new StaffHubTokenException('invalid_staff_token');
        }

        $now = time();
        $iat = $claims['iat'] ?? null;
        $exp = $claims['exp'] ?? null;
        $sid = $claims['sid'] ?? null;
        $role = $claims['role'] ?? null;
        $jti = $claims['jti'] ?? null;

        if (($claims['v'] ?? null) !== self::TOKEN_VERSION
            || ($claims['typ'] ?? null) !== self::TOKEN_TYPE
            || ! is_int($iat) || ! is_int($exp)
            || ! is_string($sid) || $sid === '' || strlen($sid) > 64
            || ! is_string($jti) || ! preg_match('/^[A-Za-z0-9_-]{16,128}$/', $jti)
            || $iat > $now + self::CLOCK_SKEW_SECONDS
            || $exp - $iat > self::MAX_LIFETIME_SECONDS
            || $exp - $iat <= 0
        ) {
            throw new StaffHubTokenException('invalid_staff_token');
        }

        if ($exp <= $now) {
            throw new StaffHubTokenException('invalid_staff_token');
        }

        // Signed by the hub, but the staff member is disabled or has no admin role.
        if (($claims['status'] ?? null) !== 'active'
            || ! is_string($role) || ! in_array($role, (array) config('ads.staff_roles'), true)
        ) {
            throw new StaffHubTokenException('staff_not_active');
        }

        // Single use: a captured token cannot be replayed within its lifetime.
        $replayKey = 'ads-staff-jti:'.hash('sha256', $jti);
        if (! Cache::add($replayKey, true, now()->addSeconds($exp - $now + 60))) {
            throw new StaffHubTokenException('invalid_staff_token');
        }

        return ['sid' => $sid, 'role' => $role, 'jti' => $jti, 'exp' => $exp];
    }

    private function base64UrlDecode(string $value): string|false
    {
        if (! preg_match('/^[A-Za-z0-9_-]+$/', $value)) {
            return false;
        }
        $padded = strtr($value, '-_', '+/').str_repeat('=', (4 - strlen($value) % 4) % 4);

        return base64_decode($padded, true);
    }
}
