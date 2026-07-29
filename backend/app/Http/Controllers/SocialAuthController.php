<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class SocialAuthController extends Controller
{
    public function redirect(string $provider)
    {
        $providers = ['google', 'facebook', 'apple'];
        if (! in_array($provider, $providers)) {
            abort(400, 'Unsupported provider.');
        }

        $clientId = config("services.{$provider}.client_id");
        $redirectUri = config("services.{$provider}.redirect");

        if (! $clientId) {
            return response()->json([
                'message' => "{$provider} login not configured. Use email registration instead.",
                'manual_register' => true,
            ]);
        }

        $url = match ($provider) {
            'google' => "https://accounts.google.com/o/oauth2/v2/auth?client_id={$clientId}&redirect_uri={$redirectUri}&response_type=code&scope=email+profile",
            'facebook' => "https://www.facebook.com/v18.0/dialog/oauth?client_id={$clientId}&redirect_uri={$redirectUri}&response_type=code&scope=email,public_profile",
            'apple' => "https://appleid.apple.com/auth/authorize?client_id={$clientId}&redirect_uri={$redirectUri}&response_type=code%20id_token&scope=name+email&response_mode=form_post",
        };

        return response()->json(['redirect_url' => $url]);
    }

    public function callback(Request $request, string $provider): JsonResponse
    {
        $code = $request->input('code');

        if (! $code) {
            return response()->json(['message' => 'Authorization code missing.'], 400);
        }

        // Simulate token exchange — in production, call provider's token endpoint with HTTP client
        $socialUser = $this->exchangeCode($provider, $code);

        if (! $socialUser || ! isset($socialUser['email'])) {
            return response()->json(['message' => 'Failed to get user info from provider.'], 400);
        }

        $user = User::where('email', $socialUser['email'])->first();

        if ($user) {
            // Link provider to existing account
            if (! $user->provider) {
                $user->update([
                    'provider' => $provider,
                    'provider_id' => $socialUser['id'],
                ]);
            }
        } else {
            $username = Str::slug(explode('@', $socialUser['email'])[0], '_');
            $username = substr($username, 0, 40);

            // Ensure unique username
            $base = $username;
            $i = 1;
            while (User::where('username', $username)->exists()) {
                $username = $base . $i;
                $i++;
            }

            $trialDays = (int) \App\Models\AdminSetting::get('free_username_trial_days', 7);

            $user = User::create([
                'name' => $socialUser['name'] ?? $socialUser['email'],
                'email' => $socialUser['email'],
                'username' => $username,
                'password' => Hash::make(Str::random(32)),
                'provider' => $provider,
                'provider_id' => $socialUser['id'],
                'avatar_url' => $socialUser['avatar'] ?? null,
                'role' => 'member',
                'username_trial_ends_at' => now()->addDays($trialDays),
                'email_verified_at' => now(),
            ]);
        }

        $token = $user->createToken('auth-token')->plainTextToken;

        return response()->json([
            'token' => $token,
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'username' => $user->username,
                'role' => $user->role,
                'avatar_url' => $user->avatar_url,
                'link_in_bio_url' => $user->getLinkInBioUrl(),
                'username_trial_ends_at' => $user->username_trial_ends_at?->toIso8601String(),
            ],
        ]);
    }

    private function exchangeCode(string $provider, string $code): ?array
    {
        // In production: POST to provider's token endpoint with $code
        // For now, return a mock that works for testing
        $decoded = json_decode(base64_decode($code), true);
        if ($decoded && isset($decoded['email'])) {
            return $decoded;
        }

        return null;
    }
}
