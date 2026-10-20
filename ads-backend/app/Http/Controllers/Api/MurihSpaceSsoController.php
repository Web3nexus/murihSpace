<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AdAccount;
use App\Models\AdAccountMember;
use App\Models\AdWallet;
use App\Models\Advertiser;
use App\Models\User;
use App\Services\MurihSpace\MurihSpaceSsoClient;
use App\Services\MurihSpace\MurihSpaceSsoException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/**
 * "Continue with MurihSpace" completion.
 *
 * Flow (see ads-frontend/app/routes/auth/sso/callback.tsx for the browser side):
 *   1. The ads frontend sends the browser to the main app. The main app issues
 *      a single-use code (POST {main}/api/v1/ads/sso/code) and returns the
 *      browser to the ads frontend callback with ?code=...&state=...
 *   2. The ads frontend posts only the code here. This controller exchanges it
 *      server-to-server, finds or creates the advertiser keyed on the
 *      MurihSpace user id, and returns an ads-backend Sanctum token.
 *
 * The browser never sees the internal token, and the redirect target is never
 * taken from the request: the exchange uses the configured redirect URI.
 */
class MurihSpaceSsoController extends Controller
{
    private const CODE_GUARD_PREFIX = 'murihspace-sso-code:';

    public function __construct(private readonly MurihSpaceSsoClient $sso)
    {
    }

    /** POST /api/auth/murihspace/complete  body: { "code": "..." } */
    public function complete(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'code' => ['required', 'string', 'min:32', 'max:128'],
        ]);
        $code = $validated['code'];

        // Local single-use guard in front of the main backend's own check, so a
        // replayed code never costs a second exchange call. Cache::add is atomic.
        $guardKey = self::CODE_GUARD_PREFIX.hash('sha256', $code);
        if (! Cache::add($guardKey, true, now()->addMinutes(10))) {
            return $this->error('invalid_code', 401);
        }

        try {
            $profile = $this->sso->exchangeCode($code);
        } catch (MurihSpaceSsoException $e) {
            // The main backend did not consume the code on a transient failure,
            // so let the user retry with the same code. Keep the guard otherwise.
            if (in_array($e->getMessage(), ['sso_unavailable', 'exchange_failed', 'sso_not_configured'], true)) {
                Cache::forget($guardKey);
            }

            return $this->fromException($e);
        }

        ['user' => $user, 'advertiser' => $advertiser] = $this->provision($profile);

        return response()->json([
            'status' => 'success',
            'token' => $user->createToken('murihspace-ads-session', ['*'])->plainTextToken,
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'username' => $profile['username'],
                'avatar_url' => $profile['avatar_url'],
            ],
            'advertiser' => $advertiser,
        ]);
    }

    private function fromException(MurihSpaceSsoException $e): JsonResponse
    {
        $reason = $e->getMessage();

        return match ($reason) {
            'invalid_code' => $this->error($reason, 401),
            'redirect_mismatch' => $this->error($reason, 422),
            'ads_upgrade_required' => $this->error($reason, 403),
            'sso_not_configured', 'internal_auth_failed' => $this->misconfigured($reason),
            default => $this->upstreamFailure($reason),
        };
    }

    private function misconfigured(string $reason): JsonResponse
    {
        Log::error('[ads-sso] main backend exchange is misconfigured', ['reason' => $reason]);

        return $this->error('sso_unavailable', 503);
    }

    private function upstreamFailure(string $reason): JsonResponse
    {
        Log::warning('[ads-sso] code exchange failed', ['reason' => $reason]);

        return $this->error('sso_unavailable', 502);
    }

    private function error(string $code, int $status): JsonResponse
    {
        return response()->json([
            'status' => 'error',
            'code' => $code,
            'message' => match ($code) {
                'invalid_code' => 'The sign-in code is invalid, expired or already used.',
                'redirect_mismatch' => 'The sign-in code was issued for a different redirect.',
                'ads_upgrade_required' => 'Upgrade your MurihSpace account to Creator or Vendor to use Ads Manager.',
                default => 'MurihSpace sign-in is unavailable right now. Please try again later.',
            },
        ], $status);
    }

    /**
     * Find or create the advertiser for a MurihSpace user id. Everything is keyed
     * on murihspace_user_id alone. The exchange returns no email, so the local
     * User is created without one; it is only the session principal.
     *
     * @param  array{murihspace_user_id:int, name:string, username:?string, avatar_url:?string}  $profile
     * @return array{user: User, advertiser: Advertiser}
     */
    private function provision(array $profile): array
    {
        $murihId = $profile['murihspace_user_id'];

        return DB::transaction(function () use ($profile, $murihId) {
            $user = User::firstOrCreate(
                ['murihspace_user_id' => $murihId],
                [
                    'name' => $profile['name'],
                    'email' => null,
                    'password' => Hash::make(Str::random(40)),
                ]
            );

            $businessName = $profile['name'].' Studio';

            $advertiser = Advertiser::firstOrCreate(
                ['murihspace_user_id' => $murihId],
                [
                    'business_name' => $businessName,
                    'business_type' => 'creator',
                    'country' => 'US',
                    'currency' => 'USD',
                    'timezone' => 'UTC',
                    'verification_status' => 'identity_verified',
                    'risk_status' => 'low',
                    'account_status' => 'active',
                ]
            );

            $adAccount = AdAccount::firstOrCreate(
                ['advertiser_id' => $advertiser->id],
                [
                    'name' => $businessName.' Ad Account',
                    'currency' => 'USD',
                    'timezone' => 'UTC',
                    'status' => 'active',
                ]
            );

            AdWallet::firstOrCreate(
                ['advertiser_id' => $advertiser->id],
                ['available_balance' => 10000, 'currency' => 'USD']
            );

            AdAccountMember::firstOrCreate(
                ['ad_account_id' => $adAccount->id, 'murihspace_user_id' => $murihId],
                ['role' => 'owner']
            );

            return ['user' => $user, 'advertiser' => $advertiser];
        });
    }
}
