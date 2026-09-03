<?php

namespace App\Http\Controllers;

use App\Models\RegistrationSession;
use App\Models\User;
use App\Services\AuthMethodConfigService;
use App\Services\AuthSessionService;
use App\Services\EmailVerificationService;
use App\Services\NotificationService;
use App\Services\SupportEventPublisher;
use App\Services\TwoFactorAuthService;
use Illuminate\Auth\Events\Registered;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function __construct(
        private readonly NotificationService $notifications,
        private readonly EmailVerificationService $emailVerification,
        private readonly \App\Services\DeviceSecurityService $deviceSecurity,
    ) {}

    public function register(Request $request): JsonResponse
    {
        if ($request->filled('email')) {
            $request->merge(['email' => strtolower(trim($request->email))]);
        } else {
            $request->merge(['email' => null]);
        }

        $viaSession = $request->filled('registration_session_id');

        if ($viaSession) {
            if (! app(AuthMethodConfigService::class)->registrationEnabled('phone_otp')) {
                throw ValidationException::withMessages([
                    'phone' => ['Phone registration is currently disabled.'],
                ]);
            }
        } elseif (! app(AuthMethodConfigService::class)->registrationEnabled('email_password')) {
            throw ValidationException::withMessages([
                'email' => ['Email registration is currently disabled.'],
            ]);
        }

        $request->validate([
            'registration_session_id' => ['required_without:email', 'string', 'max:255'],
            'name' => ['required', 'string', 'max:255'],
            'email' => $viaSession
                ? ['nullable', 'string', 'email', 'max:255', 'unique:users,email']
                : ['required', 'string', 'email', 'max:255', 'unique:users'],
            'password' => ['required', 'string', 'min:8', 'confirmed', 'regex:/[A-Z]/', 'regex:/[a-z]/', 'regex:/[0-9]/'],
            'username' => ['required', 'string', 'min:3', 'max:50', 'unique:users', 'regex:/\A[a-zA-Z0-9_]+\z/'],
            'country' => ['nullable', 'string', 'size:2', 'exists:countries,iso2'],
            'mobile_number' => ['nullable', 'string', 'regex:/^\+?[1-9]\d{1,14}$/'],
            'county' => ['nullable', 'string', 'max:255'],
            'state' => ['nullable', 'string', 'max:255'],
            'role' => ['nullable', 'string', 'in:member,creator,vendor,user'],
            'kyc_document' => ['nullable', 'string'],
        ]);

        // Phone-first path: identity (number + country) comes from the verified
        // registration session and is never repeated in the registration wizard.
        $registrationSession = null;
        if ($viaSession) {
            $registrationSession = RegistrationSession::where('token', $request->registration_session_id)->first();

            if (! $registrationSession || ! $registrationSession->isValid()) {
                throw ValidationException::withMessages([
                    'registration_session_id' => ['The registration session is invalid or has expired. Please verify your number again.'],
                ]);
            }

            $phoneExists = User::where('mobile_number', $registrationSession->phone_e164)->exists();
            if ($phoneExists) {
                throw ValidationException::withMessages([
                    'phone' => ['An account already exists with this number. Sign in instead.'],
                ]);
            }
        }

        $requestedRole = $request->input('role', 'member') ?: 'member';
        if ($requestedRole === 'user') {
            $requestedRole = 'member';
        }
        $kycStatus = $requestedRole !== 'member' ? 'not_started' : 'not_required';

        $user = User::create([
            'name' => $request->name,
            'email' => $request->email,
            'password' => Hash::make($request->password),
            'username' => $request->username,
            'country' => $registrationSession?->country_iso2 ?? $request->country,
            'mobile_number' => $registrationSession?->phone_e164 ?? $request->mobile_number,
            'phone_verified_at' => $registrationSession ? now() : null,
            'county' => $request->county,
            'state' => $request->state,
            'role' => $requestedRole,
            'kyc_status' => $kycStatus,
            'kyc_document' => $request->kyc_document,
        ]);

        if ($registrationSession) {
            $registrationSession->update([
                'verification_status' => 'consumed',
                'completed_user_id' => $user->id,
            ]);
        }

        event(new Registered($user));

        try {
            SupportEventPublisher::push(
                'user.created',
                payload: [
                    'user' => $user->only(['id', 'username', 'role']),
                    'role' => $requestedRole,
                ],
                actorType: 'user',
                actorReference: (string) $user->id,
                user: $user,
            );
        } catch (\Throwable $e) {
            report($e);
        }

        $token = app(AuthSessionService::class)->issue($user, $request)['token'];
        $this->deviceSecurity->registerActiveSession($user, $request, $token);

        try {
            if ($user->email) {
                $this->notifications->actionEmail(
                    user: $user,
                    title: 'Welcome to MurihSpace, '.e($user->name).'!',
                    bodyHtml: '<p>Welcome to MurihSpace, '.e($user->name).'! Your account is ready.</p><p>Create your profile, share posts, join communities, and connect with creators and members around the world.</p>',
                    actionLabel: 'Explore MurihSpace',
                    actionUrl: NotificationService::link('app'),
                    template: 'welcome',
                );

                $this->emailVerification->issue($user);
            }
        } catch (\Throwable $e) {
            report($e);
        }

        return response()->json([
            'message' => 'User registered successfully.',
            'token' => $token,
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'username' => $user->username,
                'role' => $user->role,
                'bio' => $user->bio,
                'avatar' => $user->avatar,
                'avatar_url' => $user->avatar_url ?? $user->avatar,
                'banner_url' => $user->banner_url,
                'mobile_number' => $user->mobile_number,
                'phone' => $user->mobile_number,
                'birthday' => $user->birthday?->format('Y-m-d'),
                'country' => $user->country,
                'county' => $user->county,
                'state' => $user->state,
                'kyc_status' => $user->kyc_status,
                'email_verified' => $user->hasVerifiedEmail(),
                'phone_verified' => $user->hasVerifiedPhone(),
                'link_in_bio_url' => $user->getLinkInBioUrl(),
                'posts_count' => 0,
                'followers_count' => 0,
                'following_count' => 0,
                'communities_count' => 0,
                'coins' => 0,
                'onboarding_completed' => $user->role === 'admin' || $user->creatorProfile?->onboarding_completed_at !== null,
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

    public function login(Request $request): JsonResponse
    {
        if ($request->filled('email')) {
            $request->merge(['email' => strtolower(trim($request->email))]);
        }

        if (! app(AuthMethodConfigService::class)->loginEnabled('email_password')) {
            throw ValidationException::withMessages([
                'email' => ['Email and password login is currently disabled. Use your phone number instead.'],
            ]);
        }

        $request->validate([
            'email' => ['required', 'string', 'email'],
            'password' => ['required', 'string'],
        ]);

        $user = User::withTrashed()->where('email', $request->email)->first();

        if (! $user || ! Hash::check($request->password, $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['The provided credentials do not match our records.'],
            ]);
        }

        if ($user->trashed() || $user->status === 'deleted') {
            throw ValidationException::withMessages([
                'email' => ['This account has been deleted. If you wish to recover your account, please contact support.'],
            ]);
        }

        if (in_array($user->status, ['banned', 'suspended'], true)) {
            $reason = $user->suspension_reason ? ": {$user->suspension_reason}" : '.';
            throw ValidationException::withMessages([
                'email' => ["Your account has been {$user->status}{$reason}"],
            ]);
        }

        if ($this->deviceSecurity->requiresDeviceApproval($user, $request)) {
            $pending = $this->deviceSecurity->createPendingLoginRequest($user, $request);

            return response()->json([
                'status' => 'pending_device_approval',
                'message' => 'New device login requires approval from your existing active session.',
                'pending_request' => [
                    'request_id' => $pending->id,
                    'request_token' => $pending->request_token,
                    'device_name' => $pending->device_name,
                    'platform' => $pending->platform,
                    'expires_at' => $pending->expires_at->toIso8601String(),
                ],
            ], 202);
        }

        $maxTokens = 5;
        $excess = $user->tokens()
            ->where('name', 'auth-token')
            ->orderByRaw('COALESCE(last_used_at, created_at) asc')
            ->get();

        if ($excess->count() >= $maxTokens) {
            $excess->take($excess->count() - $maxTokens + 1)->each->delete();
        }

        $expiration = (int) config('sanctum.expiration', 43200);
        $expiresAt  = now()->addMinutes($expiration > 0 ? $expiration : 43200);

        $token = $user->createToken('auth-token', ['*'], $expiresAt)->plainTextToken;

        $this->trackTokenMetadata($user, $request, $token);
        $this->deviceSecurity->registerActiveSession($user, $request, $token);

        return response()->json([
            'message' => 'Login successful.',
            'token' => $token,
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'username' => $user->username,
                'role' => $user->role,
                'bio' => $user->bio,
                'avatar' => $user->avatar,
                'avatar_url' => $user->avatar_url ?? $user->avatar,
                'banner_url' => $user->banner_url,
                'mobile_number' => $user->mobile_number,
                'phone' => $user->mobile_number,
                'birthday' => $user->birthday?->format('Y-m-d'),
                'country' => $user->country,
                'county' => $user->county,
                'state' => $user->state,
                'kyc_status' => $user->kyc_status,
                'email_verified' => $user->hasVerifiedEmail(),
                'link_in_bio_url' => $user->getLinkInBioUrl(),
                'posts_count' => $user->posts()->count(),
                'followers_count' => $user->followers()->count(),
                'following_count' => $user->follows()->count(),
                'communities_count' => $user->communities()->count(),
                'coins' => $user->wallet?->coin_balance ?? 0,
                'onboarding_completed' => $user->role === 'admin' || $user->creatorProfile?->onboarding_completed_at !== null,
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
            'password' => ['required', 'string', 'min:8', 'confirmed', 'regex:/[A-Z]/', 'regex:/[a-z]/', 'regex:/[0-9]/', 'regex:/[@$!%*#?&^_-]/'],
        ]);

        $user = $request->user();
        $user->update(['password' => Hash::make($data['password'])]);

        $user->tokens()->where('id', '!=', $user->currentAccessToken()->id)->delete();

        return response()->json(['message' => 'Password updated successfully.']);
    }

    public function enable2fa(Request $request): JsonResponse
    {
        $user = $request->user();
        $service = app(TwoFactorAuthService::class);

        $secret = $service->generateSecret();
        $recoveryCodes = $service->generateRecoveryCodes();

        $user->update([
            'two_factor_secret' => $service->encryptSecret($secret),
            'two_factor_recovery_codes' => json_encode($recoveryCodes),
        ]);

        $provisionUrl = $service->getProvisionUrl($secret, $user->email);

        return response()->json([
            'message' => 'Two-factor authentication enabled.',
            'data' => [
                'secret' => $secret,
                'provision_url' => $provisionUrl,
                'recovery_codes' => $recoveryCodes,
            ],
        ]);
    }

    public function disable2fa(Request $request): JsonResponse
    {
        $request->validate([
            'current_password' => ['required', 'current_password'],
        ]);

        $request->user()->update([
            'two_factor_secret' => null,
            'two_factor_recovery_codes' => null,
            'two_factor_confirmed_at' => null,
        ]);

        return response()->json([
            'message' => 'Two-factor authentication disabled.',
        ]);
    }

    public function confirm2fa(Request $request): JsonResponse
    {
        $request->validate([
            'code' => ['required', 'string', 'size:6'],
        ]);

        $user = $request->user();

        if (! $user->two_factor_secret) {
            throw ValidationException::withMessages([
                'code' => ['Two-factor authentication is not set up.'],
            ]);
        }

        $service = app(TwoFactorAuthService::class);
        $secret = $service->decryptSecret($user->two_factor_secret);

        if (! $service->verify($secret, $request->code)) {
            throw ValidationException::withMessages([
                'code' => ['Invalid verification code.'],
            ]);
        }

        $user->update(['two_factor_confirmed_at' => now()]);

        return response()->json([
            'message' => 'Two-factor authentication confirmed.',
        ]);
    }

    public function status2fa(Request $request): JsonResponse
    {
        return response()->json([
            'enabled' => $request->user()->two_factor_confirmed_at !== null,
        ]);
    }

    public function sessions(Request $request): JsonResponse
    {
        $currentTokenId = $request->user()->currentAccessToken()->id;

        $tokens = $request->user()->tokens()
            ->orderBy('last_used_at', 'desc')
            ->get(['id', 'name', 'ip', 'user_agent', 'last_used_at', 'created_at']);

        $mapped = $tokens->map(function ($token) use ($currentTokenId) {
            $device = 'Unknown device';
            $browser = 'Unknown';

            if ($token->user_agent) {
                $ua = $token->user_agent;
                if (preg_match('/Firefox\/(\S+)/', $ua)) {
                    $browser = 'Firefox';
                } elseif (preg_match('/Chrome\/(\S+)/', $ua)) {
                    $browser = 'Chrome';
                } elseif (preg_match('/Safari\/(\S+)/', $ua) && ! preg_match('/Chrome/', $ua)) {
                    $browser = 'Safari';
                } elseif (preg_match('/Edge\/(\S+)/', $ua)) {
                    $browser = 'Edge';
                }

                if (preg_match('/iPhone|iPad/', $ua)) {
                    $device = 'iOS Device';
                } elseif (preg_match('/Android/', $ua)) {
                    $device = 'Android Device';
                } elseif (preg_match('/Mac OS/', $ua)) {
                    $device = 'Mac';
                } elseif (preg_match('/Windows/', $ua)) {
                    $device = 'Windows';
                } elseif (preg_match('/Linux/', $ua)) {
                    $device = 'Linux';
                }
            }

            return [
                'id' => (string) $token->id,
                'device' => $device,
                'browser' => $browser,
                'ip' => $token->ip ?? 'Unknown',
                'last_active' => $token->last_used_at?->diffForHumans() ?? 'Never',
                'is_current' => $token->id === $currentTokenId,
            ];
        });

        return response()->json(['data' => $mapped]);
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

    public function approveDeviceLogin(Request $request, int $id): JsonResponse
    {
        $pending = \App\Models\PendingLoginRequest::findOrFail($id);
        $user = $request->user();

        if ($pending->user_id !== $user->id) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        if (! $pending->isPending()) {
            return response()->json(['message' => 'Login request has expired or is no longer pending.'], 422);
        }

        $currentToken = $user->currentAccessToken();
        $tokenId = ($currentToken instanceof \Laravel\Sanctum\PersonalAccessToken) ? $currentToken->id : null;

        $currentSession = $tokenId ? \App\Models\DeviceSession::where('user_id', $user->id)
            ->where('personal_access_token_id', $tokenId)
            ->first() : null;

        $this->deviceSecurity->approveLoginRequest($pending, $user, $currentSession);

        return response()->json([
            'message' => 'Device login request approved successfully.',
            'status' => 'approved',
        ]);
    }

    public function denyDeviceLogin(Request $request, int $id): JsonResponse
    {
        $pending = \App\Models\PendingLoginRequest::findOrFail($id);
        $user = $request->user();

        if ($pending->user_id !== $user->id) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        $this->deviceSecurity->denyLoginRequest($pending, $user);

        return response()->json([
            'message' => 'Device login request denied.',
            'status' => 'denied',
        ]);
    }

    public function checkDeviceLoginStatus(string $token): JsonResponse
    {
        $pending = \App\Models\PendingLoginRequest::where('request_token', $token)->firstOrFail();

        if ($pending->status === 'approved') {
            try {
                $plainToken = decrypt($pending->authorized_token);
            } catch (\Throwable $e) {
                return response()->json(['status' => 'failed', 'message' => 'Token decryption error.'], 500);
            }

            $user = $pending->user;

            return response()->json([
                'status' => 'approved',
                'token' => $plainToken,
                'user' => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'username' => $user->username,
                    'role' => $user->role,
                    'avatar_url' => $user->avatar_url ?? $user->avatar,
                    'mobile_number' => $user->mobile_number,
                    'coins' => $user->wallet?->coin_balance ?? 0,
                ],
            ]);
        }

        if ($pending->status === 'denied') {
            return response()->json([
                'status' => 'denied',
                'message' => 'Login request was rejected by your existing device.',
            ], 403);
        }

        if ($pending->expires_at->isPast() || $pending->status === 'expired') {
            return response()->json([
                'status' => 'expired',
                'message' => 'Login authorization request expired. Please sign in again.',
            ], 410);
        }

        return response()->json([
            'status' => 'pending',
            'expires_at' => $pending->expires_at->toIso8601String(),
        ]);
    }

    public function pendingLoginRequests(Request $request): JsonResponse
    {
        $requests = \App\Models\PendingLoginRequest::where('user_id', $request->user()->id)
            ->where('status', 'pending')
            ->where('expires_at', '>', now())
            ->latest()
            ->get();

        return response()->json(['data' => $requests]);
    }

    public function revokeAllOtherSessions(Request $request): JsonResponse
    {
        $user = $request->user();
        $currentToken = $user->currentAccessToken();
        $tokenId = ($currentToken instanceof \Laravel\Sanctum\PersonalAccessToken) ? $currentToken->id : null;

        if ($tokenId) {
            // Delete all other tokens
            $user->tokens()->where('id', '!=', $tokenId)->delete();

            // Mark other sessions revoked
            \App\Models\DeviceSession::where('user_id', $user->id)
                ->where('personal_access_token_id', '!=', $tokenId)
                ->update(['revoked_at' => now()]);
        } else {
            // In testing / session-based auth
            $user->tokens()->delete();
            \App\Models\DeviceSession::where('user_id', $user->id)->update(['revoked_at' => now()]);
        }

        return response()->json(['message' => 'All other active sessions have been revoked.']);
    }

    private function trackTokenMetadata(User $user, Request $request, string $plainToken): void
    {
        $accessToken = $user->tokens()->where('token', hash('sha256', explode('|', $plainToken)[1] ?? $plainToken))->first();

        if ($accessToken) {
            $accessToken->update([
                'ip' => $request->ip(),
                'user_agent' => $request->userAgent(),
            ]);
        }
    }
}
