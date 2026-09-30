<?php

namespace App\Http\Controllers;

use App\Enums\AdminRole;
use App\Models\User;
use App\Services\AuthSessionService;
use App\Services\TwoFactorAuthService;
use App\Support\AdminPermissionMatrix;
use App\Support\AdminSession;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

/**
 * Administration authentication.
 *
 * The administration surface previously had no credential of its own: the web
 * dashboard posted to the shared consumer /auth/login and the token it received
 * was admitted by a role check alone. This controller is the only place an
 * administration session is created.
 */
class AdminAuthController extends Controller
{
    public function __construct(
        private readonly AuthSessionService $sessions,
        private readonly TwoFactorAuthService $twoFactor,
    ) {}

    /**
     * Step 1 — password.
     *
     * A correct password is not enough to be admitted; it only earns a
     * single-use, IP-bound, five-minute challenge. Nothing with authority is
     * returned here.
     */
    public function login(Request $request): JsonResponse
    {
        $request->validate([
            'email' => ['required', 'string', 'email'],
            'password' => ['required', 'string'],
        ]);

        $email = strtolower(trim($request->string('email')->toString()));
        $user = User::where('email', $email)->first();

        // One message for a missing account, a wrong password, and an account
        // that simply is not an administrator. The password is verified before
        // the role is inspected so that a caller who cannot produce it learns
        // nothing at all — otherwise this endpoint becomes a way to enumerate
        $passwordOk = Hash::check(
            $request->string('password')->toString(),
            $user ? (string) $user->password : '$2y$12$usesomesillystringfore7hnbRJHxXVLeakoG8K30oukPsA.ztMG'
        );

        if (! $user || ! $passwordOk) {
            throw $this->invalidCredentials();
        }

        if (! $user->isAdmin() || ! AdminPermissionMatrix::requiresMfa($user)) {
            throw $this->invalidCredentials();
        }

        // Reachable only by a caller who has already produced the right
        // password, so describing the account state here leaks nothing new.
        if ($user->trashed() || $user->status === 'deleted') {
            throw ValidationException::withMessages([
                'email' => ['This administrator account has been deleted.'],
            ]);
        }

        if (in_array($user->status, ['banned', 'suspended'], true)) {
            $reason = $user->suspension_reason ? ": {$user->suspension_reason}" : '.';

            throw ValidationException::withMessages([
                'email' => ["This administrator account has been {$user->status}{$reason}"],
            ]);
        }

        if (! AdminPermissionMatrix::hasEnrolledMfa($user)) {
            // Not a lockout: enrolment is reachable, it just is not reachable
            // from here. The account can still sign in at /auth/login, call
            // /auth/2fa/enable and /auth/2fa/confirm, and then sign in here.
            return ApiResponse::error(
                'This administrator has not enrolled two-factor authentication. Enrol at /api/v1/auth/2fa/enable using a session from /api/v1/auth/login, then sign in again.',
                ['code' => ['admin_mfa_enrollment_required']],
                403,
            );
        }

        $challenge = AdminSession::issueChallenge($user, $request);

        return ApiResponse::success([
            'status' => 'two_factor_required',
            'challenge' => $challenge,
            'expires_in_seconds' => AdminSession::CHALLENGE_TTL_SECONDS,
            'delivery_channel' => 'authenticator_app',
        ], 'Enter the six-digit code from your authenticator app.', 202);
    }

    /**
     * Step 2 — second factor. This is the only route that mints an
     * administration session.
     */
    public function verifyTwoFactor(Request $request): JsonResponse
    {
        $request->validate([
            'challenge' => ['required', 'string'],
            'code' => ['required', 'string'],
        ]);

        $challenge = $request->string('challenge')->toString();

        $user = AdminSession::resolveChallenge($challenge, $request);

        if (! $user) {
            throw ValidationException::withMessages([
                'challenge' => ['This sign-in attempt has expired. Start again.'],
            ]);
        }

        $code = preg_replace('/\s+/', '', $request->string('code')->toString());

        if (! $this->verifyCode($user, $code)) {
            AdminSession::recordFailedChallengeAttempt($challenge);

            throw ValidationException::withMessages([
                'code' => ['That code is not valid.'],
            ]);
        }

        AdminSession::consumeChallenge($challenge);

        $session = $this->sessions->issueAdmin($user, $request);

        return ApiResponse::success([
            'token' => $session['token'],
            'expires_at' => $session['expires_at'],
            'is_new_device' => $session['is_new_device'],
            'user' => $this->adminPayload($user),
        ], 'Administrator session started.');
    }

    /**
     * Revoke the current administration session.
     *
     * Only this session is dropped. A stray admin token on a lost device is
     * handled by revoking that token in the roster; silently signing the
     * operator out of every device they are working from would be a self-
     * inflicted outage during an incident.
     */
    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()?->delete();

        return ApiResponse::success(null, 'Administrator session ended.');
    }

    /**
     * Everything an administration client needs to render itself, resolved
     * server-side so no client keeps its own copy of the matrix.
     */
    private function adminPayload(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'username' => $user->username,
            'avatar_url' => $user->avatar_url ?? $user->avatar,
            'role' => $user->role,
            'admin_role' => $user->admin_role,
            'admin_role_label' => AdminRole::tryFrom((string) $user->admin_role)?->label(),
            'is_super_admin' => $user->isSuperAdmin(),
            'mfa_enrolled' => AdminPermissionMatrix::hasEnrolledMfa($user),
            'permissions' => AdminPermissionMatrix::effectiveNamesFor($user),
            'sections' => AdminPermissionMatrix::sectionsFor($user),
        ];
    }

    /**
     * Accept either a live TOTP or a one of the eight recovery codes issued at
     * enrolment. Recovery codes exist in the database and are otherwise
     * unreachable; an administrator locked out by a lost phone with no way to
     * spend them is an availability incident, not a security control.
     */
    private function verifyCode(User $user, ?string $code): bool
    {
        if ($code === null || $code === '') {
            return false;
        }

        if ($user->two_factor_secret) {
            $secret = $this->twoFactor->decryptSecret($user->two_factor_secret);

            if ($this->twoFactor->verify($secret, $code)) {
                return true;
            }
        }

        $recoveryCodes = json_decode((string) $user->two_factor_recovery_codes, true);

        if (! is_array($recoveryCodes)) {
            return false;
        }

        $normalised = strtoupper($code);
        $matched = null;

        foreach ($recoveryCodes as $index => $stored) {
            if (hash_equals((string) $stored, $normalised)) {
                $matched = $index;

                break;
            }
        }

        if ($matched === null) {
            return false;
        }

        unset($recoveryCodes[$matched]);
        $user->update(['two_factor_recovery_codes' => json_encode(array_values($recoveryCodes))]);

        return true;
    }

    private function invalidCredentials(): ValidationException
    {
        return ValidationException::withMessages([
            'email' => ['The provided credentials do not match our records.'],
        ]);
    }
}
