<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Middleware\AdminMiddleware;
use App\Models\User;
use App\Services\Staff\StaffHubTokenException;
use App\Services\Staff\StaffHubTokenVerifier;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/**
 * Ads staff sign-in. POST /api/auth/staff/hub-session  body: { "token": "..." }
 *
 * The marketing hub is the only place staff sign in. It issues a short-lived
 * signed token (see StaffHubTokenVerifier). A valid token creates an ads admin
 * session: a Sanctum token that carries only the ads:admin ability and expires.
 * No password is accepted or checked here.
 */
class StaffHubAuthController extends Controller
{
    public function __construct(private readonly StaffHubTokenVerifier $verifier)
    {
    }

    public function session(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'token' => ['required', 'string', 'max:2048'],
        ]);

        try {
            $claims = $this->verifier->verify($validated['token']);
        } catch (StaffHubTokenException $e) {
            return $this->refuse($e->getMessage());
        }

        // Staff are not advertisers: no MurihSpace id, no email. The row exists
        // only to own the admin session. Its password is random and unused.
        $staff = User::firstOrCreate(
            ['staff_hub_id' => $claims['sid']],
            [
                'name' => 'Staff '.$claims['sid'],
                'password' => Hash::make(Str::random(64)),
            ]
        );

        $expiresAt = now()->addMinutes((int) config('ads.staff_session_minutes', 480));
        $token = $staff->createToken(
            'ads-staff-session',
            [AdminMiddleware::ABILITY],
            $expiresAt
        );

        Log::info('[ads-staff] admin session issued', ['staff_hub_id' => $claims['sid'], 'role' => $claims['role']]);

        return response()->json([
            'status' => 'success',
            'token' => $token->plainTextToken,
            'token_type' => 'Bearer',
            'expires_at' => $expiresAt->toIso8601String(),
            'staff' => [
                'id' => $claims['sid'],
                'role' => $claims['role'],
            ],
        ]);
    }

    private function refuse(string $reason): JsonResponse
    {
        Log::warning('[ads-staff] staff sign-in refused', ['reason' => $reason]);

        [$status, $message] = match ($reason) {
            'staff_sign_in_unavailable' => [503, 'Staff sign-in is not available.'],
            'staff_not_active' => [403, 'This staff account is not active.'],
            default => [401, 'The staff sign-in token is invalid or expired.'],
        };

        return response()->json([
            'status' => 'error',
            'code' => $reason,
            'message' => $message,
        ], $status);
    }
}
