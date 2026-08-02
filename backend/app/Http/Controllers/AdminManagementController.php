<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\User;
use App\Services\NotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class AdminManagementController extends Controller
{
    public function __construct(private readonly NotificationService $notifications)
    {
    }
    public const ROLES = [
        'super_admin' => 'Super Admin',
        'content_admin' => 'Content Admin',
        'commerce_admin' => 'Commerce Admin',
        'support_admin' => 'Support Admin',
    ];

    public const PERMISSIONS = [
        'users' => 'User management',
        'kyc' => 'KYC verification',
        'content' => 'Content moderation',
        'commerce' => 'Commerce & orders',
        'payouts' => 'Payouts & escrow',
        'analytics' => 'Analytics & reports',
        'settings' => 'Platform settings',
        'admins' => 'Admin management',
    ];

    public function roles(): JsonResponse
    {
        return response()->json([
            'data' => [
                'roles' => self::ROLES,
                'permissions' => self::PERMISSIONS,
            ],
        ]);
    }

    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'per_page' => ['nullable', 'integer', 'min:10', 'max:100'],
        ]);

        $query = User::select([
            'id', 'name', 'email', 'username', 'role', 'admin_role', 'admin_permissions',
            'status', 'created_at',
        ])->where('role', 'admin');

        if (! empty($validated['search'])) {
            $s = $validated['search'];
            $query->where(function ($q) use ($s) {
                $q->where('name', 'like', "%{$s}%")
                    ->orWhere('email', 'like', "%{$s}%")
                    ->orWhere('username', 'like', "%{$s}%");
            });
        }

        $query->orderByRaw("CASE WHEN admin_role = 'super_admin' THEN 0 ELSE 1 END")
            ->orderBy('created_at', 'desc');

        return response()->json(
            $query->paginate($validated['per_page'] ?? 20)
        );
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'user_id' => ['nullable', 'integer', 'exists:users,id'],
            'name' => ['required_if:user_id,null', 'string', 'max:100'],
            'email' => ['required_if:user_id,null', 'string', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required_if:user_id,null', 'string', 'min:8'],
            'admin_role' => ['required', 'string', 'in:'.implode(',', array_keys(self::ROLES))],
            'permissions' => ['nullable', 'array'],
            'permissions.*' => ['string', 'in:'.implode(',', array_keys(self::PERMISSIONS))],
        ]);

        $permissions = $validated['admin_role'] === 'super_admin'
            ? array_keys(self::PERMISSIONS)
            : ($validated['permissions'] ?? []);

        if ($validated['user_id'] ?? null) {
            $user = User::findOrFail($validated['user_id']);

            if ($user->role !== 'admin') {
                $user->update([
                    'role' => 'admin',
                    'admin_role' => $validated['admin_role'],
                    'admin_permissions' => $permissions,
                ]);
            } else {
                return response()->json(['message' => 'User is already an admin.'], 422);
            }
        } else {
            $username = Str::slug(explode('@', $validated['email'])[0], '_');
            $base = $username;
            $i = 1;
            while (User::where('username', $username)->exists()) {
                $username = $base . $i;
                $i++;
            }

            $user = User::create([
                'name' => $validated['name'],
                'email' => $validated['email'],
                'password' => Hash::make($validated['password']),
                'username' => $username,
                'role' => 'admin',
                'admin_role' => $validated['admin_role'],
                'admin_permissions' => $permissions,
                'status' => 'active',
                'email_verified_at' => now(),
            ]);
        }

        AuditLog::create([
            'user_id' => $request->user()->id,
            'action' => 'admin.created',
            'resource_type' => 'user',
            'resource_id' => (string) $user->id,
            'metadata' => ['admin_role' => $validated['admin_role'], 'permissions' => $permissions],
        ]);

        $this->notifications->actionEmail(
            user: $user,
            title: 'Your admin account is ready',
            bodyHtml: '<p>You have been granted an <strong>admin role</strong> on the MurihSpace platform ('.e(self::ROLES[$validated['admin_role']] ?? $validated['admin_role']).'). You can now sign in through the Securegate admin portal.</p>',
            actionLabel: 'Open Securegate',
            actionUrl: NotificationService::link('securegate/login'),
            template: 'admin_role_granted',
            data: ['role' => e(self::ROLES[$validated['admin_role']] ?? $validated['admin_role'])],
        );

        return response()->json([
            'message' => 'Admin added.',
            'data' => $this->present($user),
        ], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $user = User::findOrFail($id);

        if ($user->role !== 'admin') {
            return response()->json(['message' => 'User is not an admin.'], 422);
        }

        $requestingUser = $request->user();

        if ($user->id === $requestingUser->id) {
            return response()->json(['message' => 'You cannot edit your own admin account.'], 422);
        }

        if ($user->isSuperAdmin() && ! $requestingUser->isSuperAdmin()) {
            return response()->json(['message' => 'Only a super admin can modify a super admin.'], 403);
        }

        $validated = $request->validate([
            'admin_role' => ['required', 'string', 'in:'.implode(',', array_keys(self::ROLES))],
            'permissions' => ['nullable', 'array'],
            'permissions.*' => ['string', 'in:'.implode(',', array_keys(self::PERMISSIONS))],
            'status' => ['sometimes', 'string', 'in:active,suspended'],
        ]);

        $permissions = $validated['admin_role'] === 'super_admin'
            ? array_keys(self::PERMISSIONS)
            : ($validated['permissions'] ?? []);

        $user->update([
            'admin_role' => $validated['admin_role'],
            'admin_permissions' => $permissions,
            'status' => $validated['status'] ?? $user->status,
        ]);

        AuditLog::create([
            'user_id' => $requestingUser->id,
            'action' => 'admin.updated',
            'resource_type' => 'user',
            'resource_id' => (string) $user->id,
            'metadata' => ['admin_role' => $validated['admin_role'], 'permissions' => $permissions],
        ]);

        $this->notifications->actionEmail(
            user: $user,
            title: 'Your admin access was updated',
            bodyHtml: '<p>Your admin role and permissions on MurihSpace were recently updated by a super admin. If you did not expect this change, please contact a platform administrator.</p>',
            actionLabel: 'Open Securegate',
            actionUrl: NotificationService::link('securegate/login'),
            template: 'admin_role_updated',
        );

        return response()->json([
            'message' => 'Admin updated.',
            'data' => $this->present($user),
        ]);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $user = User::findOrFail($id);

        if ($user->role !== 'admin') {
            return response()->json(['message' => 'User is not an admin.'], 422);
        }

        $requestingUser = $request->user();

        if ($user->id === $requestingUser->id) {
            return response()->json(['message' => 'You cannot remove your own admin account.'], 422);
        }

        if ($user->isSuperAdmin() && ! $requestingUser->isSuperAdmin()) {
            return response()->json(['message' => 'Only a super admin can remove a super admin.'], 403);
        }

        $user->update([
            'role' => 'member',
            'admin_role' => null,
            'admin_permissions' => null,
        ]);

        AuditLog::create([
            'user_id' => $requestingUser->id,
            'action' => 'admin.removed',
            'resource_type' => 'user',
            'resource_id' => (string) $user->id,
        ]);

        $this->notifications->actionEmail(
            user: $user,
            title: 'Your admin access has been removed',
            bodyHtml: '<p>Your admin role on the MurihSpace platform has been <strong>removed</strong> by a super admin. You still have a regular member account and can continue using the platform.</p>',
            template: 'admin_role_removed',
        );

        return response()->json(['message' => 'Admin removed.']);
    }

    private function present(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'username' => $user->username,
            'role' => $user->role,
            'admin_role' => $user->admin_role,
            'admin_permissions' => $user->admin_permissions ?? [],
            'status' => $user->status,
            'created_at' => $user->created_at?->toIso8601String(),
        ];
    }
}
