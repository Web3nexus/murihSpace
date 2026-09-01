<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ProfileController extends Controller
{
    /**
     * Display the authenticated user's profile.
     */
    public function show(Request $request): JsonResponse
    {
        $user = $request->user();

        return response()->json([
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'username' => $user->username,
            'role' => $user->role,
            'bio' => $user->bio,
            'avatar' => $user->avatar,
            'banner_url' => $user->banner_url ?? null,
            'country' => $user->country,
            'county' => $user->county,
            'state' => $user->state,
            'mobile_number' => $user->mobile_number,
            'kyc_status' => $user->kyc_status,
            'kyc_document' => $user->kyc_document,
            'kyc_rejection_reason' => $user->kyc_rejection_reason,
            'has_active_verification_badge' => $user->hasActiveVerificationBadge(),
            'email_verified' => $user->hasVerifiedEmail(),
            'posts_count' => $user->posts()->count(),
            'followers_count' => $user->followers()->count(),
            'following_count' => $user->follows()->count(),
            'communities_count' => $user->communities()->count(),
            'coins' => $user->wallet?->coin_balance ?? 0,
            'created_at' => $user->created_at?->toISOString(),
        ]);
    }

    /**
     * Update the authenticated user's profile details.
     */
    public function update(Request $request): JsonResponse
    {
        $user = $request->user();

        $validated = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'username' => ['sometimes', 'required', 'string', 'min:3', 'max:255', Rule::unique('users')->ignore($user->id)],
            'bio' => ['nullable', 'string', 'max:1000'],
            'avatar' => ['nullable', 'string', 'max:2048'],
            'country' => ['nullable', 'string', 'max:255'],
            'county' => ['nullable', 'string', 'max:255'],
            'state' => ['nullable', 'string', 'max:255'],
            'mobile_number' => ['nullable', 'string', 'max:255'],
        ]);

        $user->update($validated);

        return response()->json([
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'username' => $user->username,
            'role' => $user->role,
            'bio' => $user->bio,
            'avatar' => $user->avatar,
            'country' => $user->country,
            'county' => $user->county,
            'state' => $user->state,
            'mobile_number' => $user->mobile_number,
            'kyc_status' => $user->kyc_status,
            'email_verified' => $user->hasVerifiedEmail(),
        ]);
    }

    /**
     * Submit identity verification (KYC) documents.
     */
    public function submitKyc(Request $request): JsonResponse
    {
        $user = $request->user();

        $validated = $request->validate([
            'kyc_document' => ['required', 'string', 'max:2048'],
        ]);

        $user->update([
            'kyc_document' => $validated['kyc_document'],
            'kyc_status' => 'pending',
            'kyc_rejection_reason' => null,
        ]);

        return response()->json([
            'kyc_status' => $user->kyc_status,
            'kyc_document' => $user->kyc_document,
        ]);
    }

    public function updatePrivacy(Request $request): JsonResponse
    {
        $data = $request->validate([
            'show_online_status' => 'boolean',
            'show_last_seen' => 'boolean',
            'show_email' => 'boolean',
            'show_phone' => 'boolean',
        ]);

        $request->user()->update($data);

        return response()->json(['message' => 'Privacy settings updated.', 'data' => $data]);
    }

    public function exportData(Request $request): JsonResponse
    {
        $user = $request->user();

        return response()->json([
            'user' => $user->toArray(),
            'wallet' => $user->wallet?->toArray(),
            'profile' => $user->profile?->toArray(),
        ]);
    }

    public function deleteAccount(Request $request): JsonResponse
    {
        $user = $request->user();

        // If user has a password set, require password or explicit DELETE confirmation
        if ($user->password) {
            if ($request->filled('password')) {
                $request->validate([
                    'password' => ['required', 'current_password'],
                ]);
            } else {
                $request->validate([
                    'confirmation' => ['required', 'string', 'in:DELETE,delete'],
                ]);
            }
        } else {
            // Passwordless (phone OTP / OAuth) users confirm via confirmation keyword
            $request->validate([
                'confirmation' => ['required', 'string', 'in:DELETE,delete'],
            ]);
        }

        // 1. Revoke API tokens
        $user->tokens()->delete();

        // 2. Delete push notification device tokens
        \App\Models\PushToken::where('user_id', $user->id)->delete();

        // 3. Mark user as deleted and free up username, while keeping user_id for financial compliance audit
        $originalUsername = $user->username;
        $user->update([
            'status' => 'deleted',
            'username' => null, // Free username for future reuse
            'bio' => null,
            'avatar' => null,
            'avatar_url' => null,
        ]);

        // 4. Soft delete user (preserves all ledger transactions, orders, and financial history)
        $user->delete();

        // 5. Create immutable audit log
        \App\Models\AuditLog::create([
            'user_id' => $user->id,
            'action' => 'account.deleted',
            'details' => json_encode([
                'reason' => $request->input('reason', 'User initiated account deletion'),
                'previous_username' => $originalUsername,
                'email' => $user->email,
                'mobile_number' => $user->mobile_number,
                'ip' => $request->ip(),
                'user_agent' => $request->userAgent(),
            ]),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Your account has been deleted successfully. Financial and audit records have been securely retained in accordance with legal and regulatory compliance standards.',
        ]);
    }

    public function kycStatus(Request $request): JsonResponse
    {
        $user = $request->user();

        return response()->json([
            'kyc_status' => $user->kyc_status ?? 'unsubmitted',
            'kyc_document' => $user->kyc_document,
            'kyc_rejection_reason' => $user->kyc_rejection_reason,
        ]);
    }

    /**
     * Switch active profile mode (member, creator, vendor).
     */
    public function switchRole(Request $request): JsonResponse
    {
        $user = $request->user();

        $validated = $request->validate([
            'role' => ['required', 'string', 'in:member,creator,vendor,admin'],
        ]);

        $targetRole = $validated['role'];

        // Admin can switch to any mode
        if ($user->role === 'admin' || $user->admin_role) {
            $user->update(['role' => $targetRole]);
            return response()->json([
                'message' => "Switched active mode to {$targetRole}.",
                'role' => $user->role,
            ]);
        }

        // Check if user has approved history or holds unlocked roles
        $hasApprovedRole = \App\Models\AccountRoleHistory::where('user_id', $user->id)
            ->where(function ($q) use ($targetRole) {
                $q->where('requested_role', $targetRole)
                  ->orWhere('previous_role', $targetRole)
                  ->orWhere('status', 'approved');
            })
            ->exists();

        if ($targetRole === 'member' || $hasApprovedRole || $user->role === $targetRole || in_array($targetRole, ['creator', 'vendor'], true)) {
            $user->update(['role' => $targetRole]);
            return response()->json([
                'message' => "Switched active mode to {$targetRole}.",
                'role' => $user->role,
            ]);
        }

        return response()->json([
            'message' => "You must apply and upgrade to {$targetRole} before switching to this mode.",
        ], 403);
    }
}
