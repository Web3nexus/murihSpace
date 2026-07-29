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
            'country' => $user->country,
            'county' => $user->county,
            'state' => $user->state,
            'mobile_number' => $user->mobile_number,
            'kyc_status' => $user->kyc_status,
            'kyc_document' => $user->kyc_document,
            'kyc_rejection_reason' => $user->kyc_rejection_reason,
            'email_verified' => $user->hasVerifiedEmail(),
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
        $request->validate([
            'password' => ['required', 'current_password'],
        ]);

        $user = $request->user();
        $user->tokens()->delete();
        $user->update([
            'name' => 'Deleted User',
            'email' => "deleted-{$user->id}@murihspace.local",
            'username' => null,
            'mobile_number' => null,
            'kyc_document' => null,
            'kyc_rejection_reason' => null,
            'bio' => null,
            'avatar' => null,
            'provider_id' => null,
        ]);
        $user->delete();

        return response()->json(['message' => 'Account deleted.']);
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
}
