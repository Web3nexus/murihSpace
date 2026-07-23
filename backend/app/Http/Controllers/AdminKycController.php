<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminKycController extends Controller
{
    /**
     * List all pending KYC submissions.
     */
    public function index(): JsonResponse
    {
        $pendingUsers = User::where('kyc_status', 'pending')
            ->select(['id', 'name', 'email', 'username', 'role', 'kyc_status', 'kyc_document', 'created_at'])
            ->latest()
            ->get();

        return response()->json($pendingUsers);
    }

    /**
     * Approve a user's KYC submission.
     */
    public function approve(User $user): JsonResponse
    {
        $user->update([
            'kyc_status' => 'verified',
            'kyc_rejection_reason' => null,
        ]);

        return response()->json([
            'id' => $user->id,
            'kyc_status' => $user->kyc_status,
        ]);
    }

    /**
     * Reject a user's KYC submission.
     */
    public function reject(Request $request, User $user): JsonResponse
    {
        $request->validate([
            'reason' => ['required', 'string', 'max:500'],
        ]);

        $user->update([
            'kyc_status' => 'rejected',
            'kyc_rejection_reason' => $request->reason,
        ]);

        return response()->json([
            'id' => $user->id,
            'kyc_status' => $user->kyc_status,
            'kyc_rejection_reason' => $user->kyc_rejection_reason,
        ]);
    }
}
