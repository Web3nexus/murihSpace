<?php

namespace App\Services\Staff;

use App\Models\StaffUser;
use Carbon\CarbonImmutable;
use Illuminate\Support\Str;

/**
 * Issues a staff token for the ads backend (web/ads-backend
 * app/Services/Staff/StaffHubTokenVerifier.php). The format must match that
 * verifier exactly:
 *
 *   token     = base64url(JSON claims) . "." . lowercase hex HMAC-SHA256(secret, base64url(JSON claims))
 *   base64url = URL-safe alphabet, no padding
 *   claims    = v=1, typ="ads-staff", sid=<staff id>, role=admin|moderator,
 *               status="active", iat, exp (exp - iat <= 300), jti (16-128 of [A-Za-z0-9_-])
 */
class AdsStaffTokenIssuer
{
    public const TOKEN_VERSION = 1;

    public const TOKEN_TYPE = 'ads-staff';

    public const MAX_LIFETIME_SECONDS = 300;

    /**
     * @return array{token: string, role: string, staff_id: string, expires_at: CarbonImmutable}
     *
     * @throws AdsStaffTokenException
     */
    public function issue(StaffUser $staff): array
    {
        $secret = (string) config('staff_ads.hub_secret');
        if ($secret === '') {
            throw new AdsStaffTokenException('ads_token_unavailable');
        }

        if (! $staff->isActive()) {
            throw new AdsStaffTokenException('staff_not_active');
        }

        $role = config('staff_ads.roles.'.$staff->role);
        if (! is_string($role) || $role === '') {
            throw new AdsStaffTokenException('no_matching_role');
        }

        $ttl = min(max(1, (int) config('staff_ads.token_ttl_seconds', 120)), self::MAX_LIFETIME_SECONDS);
        $issuedAt = time();
        $expiresAt = $issuedAt + $ttl;
        $staffId = (string) $staff->id;

        $payload = self::base64UrlEncode(json_encode([
            'v' => self::TOKEN_VERSION,
            'typ' => self::TOKEN_TYPE,
            'sid' => $staffId,
            'role' => $role,
            'status' => 'active',
            'iat' => $issuedAt,
            'exp' => $expiresAt,
            'jti' => Str::random(32),
        ], JSON_THROW_ON_ERROR));

        return [
            'token' => $payload.'.'.hash_hmac('sha256', $payload, $secret),
            'role' => $role,
            'staff_id' => $staffId,
            'expires_at' => CarbonImmutable::createFromTimestamp($expiresAt),
        ];
    }

    private static function base64UrlEncode(string $value): string
    {
        return rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
    }
}
