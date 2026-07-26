<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminKycController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'status' => ['sometimes', 'string', 'in:pending,verified,rejected'],
        ]);

        $status = $request->query('status', 'pending');

        $users = User::where('kyc_status', $status)
            ->select(['id', 'name', 'email', 'username', 'role', 'kyc_status', 'kyc_document', 'kyc_rejection_reason', 'created_at'])
            ->latest()
            ->get();

        $counts = [
            'pending' => User::where('kyc_status', 'pending')->count(),
            'verified' => User::where('kyc_status', 'verified')->count(),
            'rejected' => User::where('kyc_status', 'rejected')->count(),
        ];

        return response()->json(['data' => $users, 'counts' => $counts]);
    }

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
