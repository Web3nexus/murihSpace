<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Services\EmailVerificationService;
use App\Services\NotificationService;
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
    ) {}

    public function register(Request $request): JsonResponse
    {
        $viaSession = $request->filled('registration_session_id');

        if ($viaSession) {
            if (! app(\App\Services\AuthMethodConfigService::class)->registrationEnabled('phone_otp')) {
                throw ValidationException::withMessages([
                    'phone' => ['Phone registration is currently disabled.'],
                ]);
            }
        } elseif (! app(\App\Services\AuthMethodConfigService::class)->registrationEnabled('email_password')) {
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
            'password' => ['required', 'string', 'min:8', 'confirmed', 'regex:/[A-Z]/', 'regex:/[a-z]/', 'regex:/[0-9]/', 'regex:/[@$!%*#?&^_-]/'],
            'username' => ['required', 'string', 'min:3', 'max:50', 'unique:users', 'regex:/\A[a-zA-Z0-9_]+\z/'],
            'country' => ['nullable', 'string', 'size:2', 'exists:countries,iso2'],
            'mobile_number' => ['nullable', 'string', 'regex:/^\+?[1-9]\d{1,14}$/'],
            'county' => ['nullable', 'string', 'max:255'],
            'state' => ['nullable', 'string', 'max:255'],
            'role' => ['required', 'string', 'in:member,creator,vendor'],
            'kyc_document' => ['nullable', 'string'],
        ]);

        // Phone-first path: identity (number + country) comes from the verified
        // registration session and is never repeated in the registration wizard.
        $registrationSession = null;
        if ($viaSession) {
            $registrationSession = \App\Models\RegistrationSession::where('token', $request->registration_session_id)->first();

            if (! $registrationSession || ! $registrationSession->isValid()) {
                throw ValidationException::withMessages([
                    'registration_session_id' => ['The registration session is invalid or has expired. Please verify your number again.'],
                ]);
            }

            $phoneExists = \App\Models\User::where('mobile_number', $registrationSession->phone_e164)->exists();
            if ($phoneExists) {
                throw ValidationException::withMessages([
                    'phone' => ['An account already exists with this number. Sign in instead.'],
                ]);
            }
        }

        $requestedRole = $request->input('role', 'member');
        // Initial user role is always member; creator/vendor upgrades go through role application + KYC workflow
        $initialRole = 'member';
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
            'role' => $initialRole,
            'kyc_status' => $kycStatus,
            'kyc_document' => $request->kyc_document,
        ]);

        if ($registrationSession) {
            $registrationSession->update([
                'verification_status' => 'consumed',
                'completed_user_id' => $user->id,
            ]);
        }

        // If user expressed intent for creator or vendor role during registration, create pending role application
        if (in_array($requestedRole, ['creator', 'vendor'], true)) {
            try {
                app(\App\Services\RoleTransitionService::class)->apply($user, $requestedRole);
            } catch (\Throwable $e) {
                report($e);
            }
        }

        event(new Registered($user));

        $token = app(\App\Services\AuthSessionService::class)->issue($user, $request)['token'];

        try {
            $this->notifications->actionEmail(
                user: $user,
                title: 'Welcome to MurihSpace, '.e($user->name).'!',
                bodyHtml: '<p>Welcome to MurihSpace, '.e($user->name).'! Your account is ready.</p><p>Create your profile, share posts, join communities, and connect with creators and members around the world.</p>',
                actionLabel: 'Explore MurihSpace',
                actionUrl: NotificationService::link('app'),
                template: 'welcome',
            );

            $this->emailVerification->issue($user);
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
                'kyc_status' => $user->kyc_status,
                'email_verified' => $user->hasVerifiedEmail(),
                'phone_verified' => $user->hasVerifiedPhone(),
                'mobile_number' => $user->mobile_number,
                'link_in_bio_url' => $user->getLinkInBioUrl(),
                'onboarding_completed' => $user->creatorProfile?->onboarding_completed_at !== null,
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
        if (! app(\App\Services\AuthMethodConfigService::class)->loginEnabled('email_password')) {
            throw ValidationException::withMessages([
                'email' => ['Email and password login is currently disabled. Use your phone number instead.'],
            ]);
        }

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

        $maxTokens = 5;
        $excess = $user->tokens()
            ->where('name', 'auth-token')
            ->orderByRaw('COALESCE(last_used_at, created_at) asc')
            ->get();

        if ($excess->count() >= $maxTokens) {
            $excess->take($excess->count() - $maxTokens + 1)->each->delete();
        }

        $token = $user->createToken('auth-token', ['*'], now()->addMinutes((int) (config('sanctum.expiration') ?? 1440)))
            ->plainTextToken;

        $this->trackTokenMetadata($user, $request, $token);

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
                'onboarding_completed' => $user->creatorProfile?->onboarding_completed_at !== null,
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
