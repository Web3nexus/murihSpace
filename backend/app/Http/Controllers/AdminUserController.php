<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\User;
use App\Services\NotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminUserController extends Controller
{
    public function __construct(private readonly NotificationService $notifications)
    {
    }    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'role' => ['nullable', 'string', 'in:member,creator,vendor,admin'],
            'status' => ['nullable', 'string', 'in:active,suspended,banned'],
            'kyc' => ['nullable', 'string', 'in:pending,verified,rejected'],
            'sort' => ['nullable', 'string', 'in:name,email,username,role,status,kyc_status,created_at'],
            'sort_dir' => ['nullable', 'string', 'in:asc,desc'],
            'per_page' => ['nullable', 'integer', 'min:10', 'max:100'],
        ]);

        $query = User::select([
            'id', 'name', 'email', 'username', 'role', 'status',
            'kyc_status', 'created_at', 'suspended_at',
        ])->where('role', '!=', 'admin');

        if (! empty($validated['search'])) {
            $s = $validated['search'];
            $query->where(function ($q) use ($s) {
                $q->where('name', 'like', "%{$s}%")
                    ->orWhere('email', 'like', "%{$s}%")
                    ->orWhere('username', 'like', "%{$s}%");
            });
        }
        if (! empty($validated['role'])) {
            $query->where('role', $validated['role']);
        }
        if (! empty($validated['status'])) {
            $query->where('status', $validated['status']);
        }
        if (! empty($validated['kyc'])) {
            $query->where('kyc_status', $validated['kyc']);
        }

        $sortField = $validated['sort'] ?? 'created_at';
        $sortDir = $validated['sort_dir'] ?? 'desc';
        $query->orderBy($sortField, $sortDir);

        return response()->json(
            $query->paginate($validated['per_page'] ?? 20)
        );
    }

    public function show(int $id): JsonResponse
    {
        $user = User::select([
            'id', 'name', 'email', 'username', 'role', 'status',
            'kyc_status', 'kyc_rejection_reason', 'country', 'mobile_number',
            'created_at', 'suspended_at', 'suspension_reason',
            'email_verified_at',
        ])->findOrFail($id);

        return response()->json(['data' => $user]);
    }

    public function suspend(Request $request, int $id): JsonResponse
    {
        $validated = $request->validate([
            'reason' => ['required', 'string', 'max:500'],
        ]);

        $user = User::findOrFail($id);
        $user->update([
            'status' => 'suspended',
            'suspended_at' => now(),
            'suspension_reason' => $validated['reason'],
        ]);

        AuditLog::create([
            'user_id' => $request->user()->id,
            'action' => 'user.suspended',
            'resource_type' => 'user',
            'resource_id' => (string) $user->id,
            'metadata' => ['reason' => $validated['reason']],
        ]);

        try {
            $this->notifications->actionEmail(
                user: $user,
                title: 'Your account has been suspended',
                bodyHtml: '<p>Your MurihSpace account has been <strong>suspended</strong> while we review your activity. During this time you will not be able to access your account.</p>',
                footnote: 'If you believe this is a mistake, please contact support.',
            );
        } catch (\Throwable $e) {
            report($e);
        }

        return response()->json(['message' => 'User suspended.', 'data' => $user]);
    }

    public function activate(Request $request, int $id): JsonResponse
    {
        $user = User::findOrFail($id);
        $user->update([
            'status' => 'active',
            'suspended_at' => null,
            'suspension_reason' => null,
        ]);

        AuditLog::create([
            'user_id' => $request->user()->id,
            'action' => 'user.activated',
            'resource_type' => 'user',
            'resource_id' => (string) $user->id,
        ]);

        try {
            $this->notifications->actionEmail(
                user: $user,
                title: 'Your account has been reactivated',
                bodyHtml: '<p>Great news — your MurihSpace account has been <strong>reactivated</strong>. You can sign in and use the platform normally again.</p>',
                actionLabel: 'Sign in',
                actionUrl: NotificationService::link('login'),
            );
        } catch (\Throwable $e) {
            report($e);
        }

        return response()->json(['message' => 'User activated.', 'data' => $user]);
    }

    public function impersonate(Request $request, int $id): JsonResponse
    {
        $admin = $request->user();
        $target = User::findOrFail($id);

        if ($target->isAdmin()) {
            return response()->json(['message' => 'Cannot impersonate admin users.'], 403);
        }

        if ($target->status !== 'active') {
            return response()->json(['message' => 'Cannot impersonate a suspended or banned user.'], 403);
        }

        $target->tokens()->where('name', 'impersonation-token')->delete();

        $token = $target->createToken(
            'impersonation-token',
            ['impersonate'],
            now()->addMinutes(30)
        )->plainTextToken;

        AuditLog::create([
            'user_id' => $admin->id,
            'action' => 'user.impersonated',
            'resource_type' => 'user',
            'resource_id' => (string) $target->id,
            'metadata' => ['target_role' => $target->role],
        ]);

        return response()->json([
            'token' => $token,
            'user' => [
                'id' => $target->id,
                'name' => $target->name,
                'email' => $target->email,
                'username' => $target->username,
                'role' => $target->role,
            ],
        ]);
    }

    public function export(Request $request): \Illuminate\Http\Response
    {
        $validated = $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'role' => ['nullable', 'string', 'in:member,creator,vendor,admin'],
            'status' => ['nullable', 'string', 'in:active,suspended,banned'],
            'kyc' => ['nullable', 'string', 'in:pending,verified,rejected'],
            'sort' => ['nullable', 'string', 'in:name,email,username,role,status,kyc_status,created_at'],
            'sort_dir' => ['nullable', 'string', 'in:asc,desc'],
        ]);

        $query = User::select(['name', 'email', 'username', 'role', 'status', 'kyc_status', 'created_at'])
            ->where('role', '!=', 'admin');

        if (! empty($validated['search'])) {
            $s = $validated['search'];
            $query->where(fn($q) => $q->where('name', 'like', "%{$s}%")
                ->orWhere('email', 'like', "%{$s}%")
                ->orWhere('username', 'like', "%{$s}%"));
        }
        if (! empty($validated['role'])) $query->where('role', $validated['role']);
        if (! empty($validated['status'])) $query->where('status', $validated['status']);
        if (! empty($validated['kyc'])) $query->where('kyc_status', $validated['kyc']);

        $sortField = $validated['sort'] ?? 'created_at';
        $sortDir = $validated['sort_dir'] ?? 'desc';
        $query->orderBy($sortField, $sortDir);

        $csv = \League\Csv\Writer::createFromString('');
        $csv->insertOne(['Name', 'Email', 'Username', 'Role', 'Status', 'KYC Status', 'Joined']);
        $csv->insertAll($query->cursor()->map(fn($u) => [
            $u->name, $u->email, $u->username, $u->role, $u->status, $u->kyc_status, $u->created_at?->toDateString(),
        ])->toArray());

        return response($csv->toString(), 200, [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => 'attachment; filename="users-export.csv"',
        ]);
    }

    public function ban(Request $request, int $id): JsonResponse
    {
        $validated = $request->validate([
            'reason' => ['required', 'string', 'max:500'],
        ]);

        $user = User::findOrFail($id);
        $user->update([
            'status' => 'banned',
            'suspended_at' => now(),
            'suspension_reason' => $validated['reason'],
        ]);

        AuditLog::create([
            'user_id' => $request->user()->id,
            'action' => 'user.banned',
            'resource_type' => 'user',
            'resource_id' => (string) $user->id,
            'metadata' => ['reason' => $validated['reason']],
        ]);

        try {
            $this->notifications->actionEmail(
                user: $user,
                title: 'Your account has been banned',
                bodyHtml: '<p>Your MurihSpace account has been <strong>banned</strong> due to a violation of our terms of service. This decision is final.</p>',
                footnote: 'If you believe this decision is in error, you may contact our support team.',
            );
        } catch (\Throwable $e) {
            report($e);
        }

        return response()->json(['message' => 'User banned.', 'data' => $user]);
    }
}
