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

    /**
     * Legacy signed URL verification endpoint.
     */
    public function verify(Request $request, int $id, string $hash): JsonResponse
    {
        $user = \App\Models\User::findOrFail($id);

        if (! hash_equals((string) $hash, sha1($user->getEmailForVerification()))) {
            return response()->json(['message' => 'Invalid verification link.'], 403);
        }

        if ($user->hasVerifiedEmail()) {
            return response()->json(['message' => 'Email address already verified.']);
        }

        $user->markEmailAsVerified();

        return response()->json(['message' => 'Email verified successfully.']);
    }
}
