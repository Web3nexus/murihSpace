<?php

namespace App\Services;

use App\Models\User;
use App\Support\AdminSession;
use Illuminate\Http\Request;

/**
 * Issues authenticated API sessions (Sanctum bearer tokens) consistently across
 * all login paths and detects new devices for security alerts.
 */
class AuthSessionService
{
    /**
     * @return array{token: string, is_new_device: bool}
     */
    public function issue(User $user, Request $request): array
    {
        $maxTokens = 5;
        $excess = $user->tokens()
            ->where('name', 'auth-token')
            ->orderByRaw('COALESCE(last_used_at, created_at) asc')
            ->get();

        if ($excess->count() >= $maxTokens) {
            $excess->take($excess->count() - $maxTokens + 1)->each->delete();
        }

        $ip = $request->ip() ?? '';
        $userAgent = $request->userAgent() ?? '';
        $deviceKey = hash('sha256', $ip.'|'.$userAgent);

        $knownDevice = $user->tokens()
            ->where('name', 'auth-token')
            ->get()
            ->contains(fn ($token) => hash('sha256', ($token->ip ?? '').'|'.($token->user_agent ?? '')) === $deviceKey);

        $expiration = (int) config('sanctum.expiration', 43200);
        $expiresAt = now()->addMinutes($expiration > 0 ? $expiration : 43200);

        $token = $user->createToken('auth-token', ['*'], $expiresAt)
            ->plainTextToken;

        $accessToken = $user->tokens()
            ->where('token', hash('sha256', explode('|', $token)[1] ?? $token))
            ->first();

        if ($accessToken) {
            $accessToken->update([
                'ip' => $ip,
                'user_agent' => $userAgent,
            ]);
        }

        return [
            'token' => $token,
            'is_new_device' => ! $knownDevice,
        ];
    }

    /**
     * Issue an administration session.
     *
     * Distinct from issue() in three ways that all matter:
     *
     *  - The token is named `admin-token` and carries the `admin:mfa` ability.
     *    IsAdmin requires that ability, so a session that came from the shared
     *    consumer login — which admins can still reach, and must, in order to
     *    enrol a second factor — cannot open the administration surface. That is
     *    the whole point: without the tag, adding an MFA-gated admin endpoint
     *    would be theatre, because the web dashboard would still sign admins in
     *    through /auth/login and hit the same routes with no second factor.
     *
     *  - The expiry is sanctum.admin_expiration (8h), not the consumer
     *    expiry's 30-day fallback.
     *
     *  - Fewer concurrent sessions are tolerated (3 vs 5). An administration
     *    session is worth more to an attacker, so more of them being live at
     *    once is worse.
     *
     * @return array{token: string, expires_at: string, is_new_device: bool}
     */
    public function issueAdmin(User $user, Request $request): array
    {
        $maxTokens = 3;
        $excess = $user->tokens()
            ->where('name', 'admin-token')
            ->orderByRaw('COALESCE(last_used_at, created_at) asc')
            ->get();

        if ($excess->count() >= $maxTokens) {
            $excess->take($excess->count() - $maxTokens + 1)->each->delete();
        }

        $ip = $request->ip() ?? '';
        $userAgent = $request->userAgent() ?? '';
        $deviceKey = hash('sha256', $ip.'|'.$userAgent);

        $knownDevice = $user->tokens()
            ->where('name', 'admin-token')
            ->get()
            ->contains(fn ($token) => hash('sha256', ($token->ip ?? '').'|'.($token->user_agent ?? '')) === $deviceKey);

        $expiration = (int) config('sanctum.admin_expiration', 480);
        $expiresAt = now()->addMinutes($expiration > 0 ? $expiration : 480);

        $token = $user->createToken('admin-token', ['*', AdminSession::ABILITY_MFA], $expiresAt)
            ->plainTextToken;

        $accessToken = $user->tokens()
            ->where('token', hash('sha256', explode('|', $token)[1] ?? $token))
            ->first();

        if ($accessToken) {
            $accessToken->update([
                'ip' => $ip,
                'user_agent' => $userAgent,
            ]);
        }

        return [
            'token' => $token,
            'expires_at' => $expiresAt->toIso8601String(),
            'is_new_device' => ! $knownDevice,
        ];
    }

    public function userPayload(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'username' => $user->username,
            'role' => $user->role,
            'kyc_status' => $user->kyc_status,
            'email_verified' => $user->hasVerifiedEmail(),
            'phone_verified' => $user->hasVerifiedPhone(),
            'mobile_number' => $user->mobile_number,
            'link_in_bio_url' => $user->getLinkInBioUrl(),
            'onboarding_completed' => $user->role === 'admin' || $user->creatorProfile?->onboarding_completed_at !== null,
            'username_trial_ends_at' => $user->username_trial_ends_at?->toIso8601String(),
        ];
    }
}
