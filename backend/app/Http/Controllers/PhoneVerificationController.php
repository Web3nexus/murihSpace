<?php

namespace App\Http\Controllers;

use App\Services\PhoneVerificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PhoneVerificationController extends Controller
{
    public function __construct(
        private readonly PhoneVerificationService $phoneService,
    ) {}

    /**
     * Request a change of mobile phone number.
     */
    public function requestChange(Request $request): JsonResponse
    {
        $request->validate([
            'phone' => ['required', 'string', 'max:30'],
        ]);

        $user = $request->user();
        $changeReq = $this->phoneService->initiatePhoneChange($user, $request->phone);

        return response()->json([
            'message' => 'Verification code sent to your new phone number.',
            'request_id' => $changeReq->id,
            'new_phone' => $changeReq->new_phone_e164,
            'expires_at' => $changeReq->expires_at->toIso8601String(),
        ]);
    }

    /**
     * Verify the 6-digit OTP and commit the new phone number atomically.
     */
    public function verifyChange(Request $request): JsonResponse
    {
        $request->validate([
            'code' => ['required', 'string', 'size:6'],
        ]);

        $user = $request->user();
        $updatedUser = $this->phoneService->verifyAndCommitPhoneChange($user, $request->code);

        return response()->json([
            'message' => 'Your mobile number has been successfully updated and verified.',
            'mobile_number' => $updatedUser->mobile_number,
            'phone_verified' => true,
        ]);
    }
}

