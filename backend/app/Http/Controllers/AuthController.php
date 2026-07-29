<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Auth\Events\Registered;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function register(Request $request): JsonResponse
    {
        $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'email', 'max:255', 'unique:users'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
            'username' => ['required', 'string', 'min:3', 'max:50', 'unique:users', 'regex:/\A[a-zA-Z0-9_]+\z/'],
            'country' => ['nullable', 'string', 'max:255'],
            'mobile_number' => ['nullable', 'string', 'max:255'],
            'county' => ['nullable', 'string', 'max:255'],
            'state' => ['nullable', 'string', 'max:255'],
            'role' => ['required', 'string', 'in:member,creator,vendor'],
            'kyc_document' => ['nullable', 'string'],
        ]);

        $trialDays = (int) \App\Models\AdminSetting::get('free_username_trial_days', 7);

        $user = User::create([
            'name' => $request->name,
            'email' => $request->email,
            'password' => Hash::make($request->password),
            'username' => $request->username,
            'country' => $request->country,
            'mobile_number' => $request->mobile_number,
            'county' => $request->county,
            'state' => $request->state,
            'role' => $request->role,
            'kyc_status' => in_array($request->role, ['creator', 'vendor']) ? 'pending' : 'verified',
            'kyc_document' => $request->kyc_document,
            'username_trial_ends_at' => now()->addDays($trialDays),
        ]);

        event(new Registered($user));

        $token = $user->createToken('auth-token')->plainTextToken;

        return response()->json([
            'message' => 'User registered successfully. Please verify your email.',
            'token' => $token,
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'username' => $user->username,
                'role' => $user->role,
                'kyc_status' => $user->kyc_status,
                'email_verified' => $user->hasVerifiedEmail(),
                'link_in_bio_url' => $user->getLinkInBioUrl(),
                'username_trial_ends_at' => $user->username_trial_ends_at?->toIso8601String(),
            ],
        ], 201);
    }

    public function checkUsername(string $username): JsonResponse
    {
        $valid = preg_match('/\A[a-zA-Z0-9_]+\z/', $username) && strlen($username) >= 3 && strlen($username) <= 50;

        if (! $valid) {
            return response()->json([
                'available' => false,
                'message' => 'Username must be 3-50 characters, letters, numbers, and underscores only.',
            ]);
        }

        $exists = User::where('username', $username)->exists();

        return response()->json([
            'available' => ! $exists,
            'message' => $exists ? 'Username is taken.' : 'Username is available!',
        ]);
    }

    /**
     * Authenticate user and return token.
     */
    public function login(Request $request): JsonResponse
    {
        $request->validate([
            'email' => ['required', 'string', 'email'],
            'password' => ['required', 'string'],
        ]);

        $user = User::where('email', $request->email)->first();

        if (! $user || ! Hash::check($request->password, $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['The provided credentials do not match our records.'],
            ]);
        }

        $token = $user->createToken('auth-token')->plainTextToken;

        return response()->json([
            'message' => 'Login successful.',
            'token' => $token,
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'username' => $user->username,
                'role' => $user->role,
                'kyc_status' => $user->kyc_status,
                'email_verified' => $user->hasVerifiedEmail(),
                'link_in_bio_url' => $user->getLinkInBioUrl(),
                'username_trial_ends_at' => $user->username_trial_ends_at?->toIso8601String(),
            ],
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json([
            'message' => 'Logout successful.',
        ]);
    }

    public function updatePassword(Request $request): JsonResponse
    {
        $data = $request->validate([
            'current_password' => ['required', 'current_password'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ]);

        $user = $request->user();
        $user->update(['password' => Hash::make($data['password'])]);

        // Revoke other sessions
        $user->tokens()->where('id', '!=', $user->currentAccessToken()->id)->delete();

        return response()->json(['message' => 'Password updated successfully.']);
    }

    public function enable2fa(Request $request): JsonResponse
    {
        return response()->json(['message' => '2FA is not available yet.'], 501);
    }

    public function disable2fa(Request $request): JsonResponse
    {
        return response()->json(['message' => '2FA is not available yet.'], 501);
    }

    public function sessions(Request $request): JsonResponse
    {
        $tokens = $request->user()->tokens()
            ->orderBy('last_used_at', 'desc')
            ->get(['id', 'name', 'ip', 'user_agent', 'last_used_at', 'created_at']);

        return response()->json(['data' => $tokens]);
    }

    public function destroySession(Request $request, $id): JsonResponse
    {
        $token = $request->user()->tokens()->where('id', $id)->first();

        if (! $token) {
            abort(404, 'Session not found.');
        }

        $token->delete();

        return response()->json(['message' => 'Session revoked.']);
    }
}
