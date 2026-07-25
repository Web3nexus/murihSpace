<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminUserController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'role' => ['nullable', 'string', 'in:member,creator,vendor,admin'],
            'status' => ['nullable', 'string', 'in:active,suspended,banned'],
            'kyc' => ['nullable', 'string', 'in:pending,verified,rejected'],
            'per_page' => ['nullable', 'integer', 'min:10', 'max:100'],
        ]);

        $query = User::select([
            'id', 'name', 'email', 'username', 'role', 'status',
            'kyc_status', 'created_at', 'suspended_at',
        ]);

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

        return response()->json(
            $query->latest()->paginate($validated['per_page'] ?? 20)
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

        return response()->json(['message' => 'User activated.', 'data' => $user]);
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

        return response()->json(['message' => 'User banned.', 'data' => $user]);
    }
}
