<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\Advertiser;
use App\Models\AdAccount;
use App\Models\AdWallet;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class MurihSpaceAuthController extends Controller
{
    /**
     * Authenticate or register an advertiser via MurihSpace SSO token.
     * POST /api/auth/murihspace-sso
     */
    public function ssoLogin(Request $request): JsonResponse
    {
        $token = $request->input('token');
        if (!$token) {
            return response()->json(['status' => 'error', 'message' => 'SSO token is required.'], 422);
        }

        $parts = explode('.', $token);
        if (count($parts) !== 2) {
            return response()->json(['status' => 'error', 'message' => 'Malformed SSO token format.'], 401);
        }

        [$encodedPayload, $signature] = $parts;

        // Verify against the core app's key, passed explicitly via env. This is
        // a cross-service trust secret: it must never fall back to a hardcoded
        // value (previously a base64 key shipped in this controller) so anyone
        // who reads the repository could forge a valid SSO token. When unset,
        // reject the token and log the misconfiguration for the operator.
        $murihKey = (string) config('services.murihspace.app_key');

        if ($murihKey === '') {
            Log::error('[ads-sso] MURIHSPACE_APP_KEY is not configured; rejecting SSO token.');
        }

        $validSignature = $murihKey !== ''
            && hash_equals(hash_hmac('sha256', $encodedPayload, $murihKey), $signature);

        if (!$validSignature) {
            return response()->json(['status' => 'error', 'message' => 'Invalid SSO token signature.'], 401);
        }

        $payload = json_decode(base64_decode($encodedPayload), true);
        if (!$payload || !isset($payload['exp']) || time() > $payload['exp']) {
            return response()->json(['status' => 'error', 'message' => 'SSO token has expired.'], 401);
        }

        // Only Creator, Vendor and Admin MurihSpace accounts may use Ads Studio.
        // Normal members must upgrade first — surface that clearly instead of
        // silently creating an advertiser for them.
        $role = $payload['role'] ?? null;
        if (!in_array($role, ['creator', 'vendor', 'admin'], true)) {
            return response()->json([
                'status'  => 'error',
                'message' => 'You must upgrade your MurihSpace account to Creator or Vendor before you can use Ads Studio.',
            ], 403);
        }

        $email = $payload['email'] ?? null;
        $murihUserId = $payload['user_id'] ?? null;
        $name = $payload['name'] ?? 'Advertiser';
        $businessName = $payload['business_name'] ?? ($name . ' Studio');

        if (!$email || !$murihUserId) {
            return response()->json(['status' => 'error', 'message' => 'Incomplete user profile in token.'], 422);
        }

        // 1. Find or create user
        $user = User::firstOrCreate(
            ['email' => $email],
            [
                'name'     => $name,
                'password' => Hash::make(Str::random(40)),
            ]
        );

        // 2. Find or create advertiser
        $advertiser = Advertiser::firstOrCreate(
            ['murihspace_user_id' => $murihUserId],
            [
                'business_name'       => $businessName,
                'business_type'       => $role === 'vendor' ? 'ecommerce' : 'creator',
                'country'             => 'US',
                'currency'            => 'USD',
                'timezone'            => 'UTC',
                'verification_status' => 'identity_verified',
                'risk_status'         => 'low',
                'account_status'      => 'active',
            ]
        );

        // 3. Ensure Ad Account exists
        $adAccount = AdAccount::firstOrCreate(
            ['advertiser_id' => $advertiser->id],
            [
                'name'     => $businessName . ' Ad Account',
                'currency' => 'USD',
                'timezone' => 'UTC',
                'status'   => 'active',
            ]
        );

        // 4. Ensure Ad Wallet exists
        $wallet = AdWallet::firstOrCreate(
            ['advertiser_id' => $advertiser->id],
            [
                'balance'  => 100.00,
                'currency' => 'USD',
            ]
        );

        // 5. Generate Sanctum API bearer token
        $sanctumToken = $user->createToken('murihspace-ads-session', ['*'])->plainTextToken;

        return response()->json([
            'status'     => 'success',
            'token'      => $sanctumToken,
            'user'       => [
                'id'         => $user->id,
                'name'       => $user->name,
                'email'      => $user->email,
                'avatar_url' => $payload['avatar_url'] ?? null,
            ],
            'advertiser' => $advertiser,
            'account'    => $adAccount,
            'wallet'     => $wallet,
        ]);
    }
}

