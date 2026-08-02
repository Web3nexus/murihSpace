<?php

namespace App\Http\Controllers;

use App\Services\EmailVerificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class VerificationController extends Controller
{
    public function __construct(
        private readonly EmailVerificationService $emailVerification,
    ) {}

    /**
     * Send (or resend) a one-time verification code to the authenticated user.
     */
    public function sendCode(Request $request): JsonResponse
    {
        $user = $request->user();

        if ($user->hasVerifiedEmail()) {
            return response()->json([
                'message' => 'Email address already verified.',
            ], 400);
        }

        $this->emailVerification->issue($user);

        return response()->json([
            'message' => 'Verification code sent.',
        ]);
    }

    /**
     * Verify the authenticated user's email address with a one-time code.
     */
    public function verifyCode(Request $request): JsonResponse
    {
        $request->validate([
            'code' => ['required', 'string', 'digits:6'],
        ]);

        $result = $this->emailVerification->verify($request->user(), $request->input('code'));

        if (! $result['ok']) {
            return response()->json([
                'message' => $result['message'],
            ], 422);
        }

        return response()->json([
            'message' => $result['message'],
        ]);
    }

    /**
     * Resend the email verification code.
     */
    public function resend(Request $request): JsonResponse
    {
        return $this->sendCode($request);
    }
}
