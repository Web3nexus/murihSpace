<?php

namespace App\Services;

use App\Models\User;
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
        $expiresAt  = now()->addMinutes($expiration > 0 ? $expiration : 43200);

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
