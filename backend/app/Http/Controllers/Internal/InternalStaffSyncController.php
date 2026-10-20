<?php

namespace App\Http\Controllers\Internal;

use App\Enums\AdminPermission;
use App\Enums\AdminRole;
use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\Staff\StaffAccountSyncService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Receives staff records pushed by the marketing backend (the staff login).
 * Mounted under routes/internal.php, so every request passes the `internal` middleware:
 * X-Internal-Token, X-Timestamp inside the replay window, and a single-use X-Nonce.
 *
 * Responses never include a password or any credential.
 */
class InternalStaffSyncController extends Controller
{
    /**
     * POST /internal/staff/sync
     */
    public function sync(Request $request, StaffAccountSyncService $sync): JsonResponse
    {
        $validated = $request->validate([
            'staff_identity_id' => ['required', 'string', 'max:191'],
            'email' => ['required', 'string', 'email', 'max:255'],
            'name' => ['required', 'string', 'max:255'],
            'role' => ['required', 'string', 'in:'.implode(',', AdminRole::names())],
            'status' => ['required', 'string', 'in:active,disabled'],
            'permissions' => ['required', 'array', 'min:1'],
            'permissions.*' => ['required', 'string', 'in:'.implode(',', AdminPermission::names())],
        ]);

        $result = $sync->upsert($validated, $request->ip(), $request->userAgent());

        if ($result['status'] === StaffAccountSyncService::STATUS_CONFLICT) {
            return response()->json([
                'status' => 'error',
                'code' => 'email_in_use',
                'message' => 'This email belongs to another account and cannot be assigned to staff.',
            ], 409);
        }

        return response()->json([
            'status' => 'success',
            'created' => $result['status'] === StaffAccountSyncService::STATUS_CREATED,
            'data' => $this->present($result['user']),
        ], $result['status'] === StaffAccountSyncService::STATUS_CREATED ? 201 : 200);
    }

    /**
     * POST /internal/staff/disable
     * Disable-only path: the account is suspended and its tokens revoked. Nothing is deleted.
     */
    public function disable(Request $request, StaffAccountSyncService $sync): JsonResponse
    {
        $validated = $request->validate([
            'staff_identity_id' => ['required', 'string', 'max:191'],
        ]);

        $result = $sync->disable($validated['staff_identity_id'], $request->ip(), $request->userAgent());

        if ($result['status'] === StaffAccountSyncService::STATUS_NOT_FOUND) {
            return response()->json([
                'status' => 'error',
                'code' => 'staff_not_found',
                'message' => 'No staff account is linked to this staff identity id.',
            ], 404);
        }

        return response()->json([
            'status' => 'success',
            'data' => $this->present($result['user']),
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function present(User $user): array
    {
        return [
            'user_id' => $user->id,
            'staff_identity_id' => $user->staff_identity_id,
            'email' => $user->email,
            'name' => $user->name,
            'role' => $user->admin_role,
            'status' => $user->status === 'active' ? 'active' : 'disabled',
            'permissions' => $user->admin_permissions ?? [],
        ];
    }
}
