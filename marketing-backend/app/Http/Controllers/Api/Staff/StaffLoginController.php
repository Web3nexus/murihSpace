<?php

namespace App\Http\Controllers\Api\Staff;

use App\Http\Controllers\Controller;
use App\Http\Resources\StaffAccountResource;
use App\Models\AuditLog;
use App\Services\AuditLogService;
use App\Services\StaffAuthenticator;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Staff-only token login. Customers and other users have no path here: the
 * token is issued from the staff table only.
 */
class StaffLoginController extends Controller
{
    public function __construct(
        protected StaffAuthenticator $authenticator,
        protected AuditLogService $audit,
    ) {}

    public function login(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'string', 'email', 'max:255'],
            'password' => ['required', 'string', 'max:1024'],
        ]);

        $staff = $this->authenticator->attempt($data['email'], $data['password'], $request);

        if ($staff === null) {
            // One generic answer for unknown email, wrong password, lockout and disabled.
            return response()->json([
                'success' => false,
                'data' => null,
                'message' => 'Invalid credentials.',
                'errors' => null,
            ], 401);
        }

        $expiresAt = now()->addMinutes((int) config('staff.token_minutes', 480));
        $token = $staff->createToken('staff-api', ['staff'], $expiresAt);

        $this->audit->record(AuditLog::STAFF_API_LOGIN, actor: $staff, subject_reference: $staff->email, after: ['ip' => $request->ip()]);

        return response()->json([
            'success' => true,
            'data' => [
                'token' => $token->plainTextToken,
                'token_type' => 'Bearer',
                'expires_at' => $expiresAt->toIso8601String(),
                'staff' => new StaffAccountResource($staff),
            ],
            'message' => 'Signed in.',
            'errors' => null,
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $staff = $request->user('staff_api');
        $staff?->currentAccessToken()?->delete();

        if ($staff) {
            $this->audit->record(AuditLog::STAFF_API_LOGOUT, actor: $staff, subject_reference: $staff->email);
        }

        return response()->json(['success' => true, 'data' => null, 'message' => 'Signed out.', 'errors' => null]);
    }
}
