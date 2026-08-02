<?php

namespace App\Http\Controllers;

use App\Services\NotificationService;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class PasswordResetController extends Controller
{
    public function __construct(
        private readonly NotificationService $notifications,
    ) {}

    public function forgotPassword(Request $request): JsonResponse
    {
        $request->validate([
            'email' => ['required', 'string', 'email', 'max:255'],
        ]);

        $status = Password::sendResetLink(
            $request->only('email'),
            function ($user, $token) {
                $resetUrl = NotificationService::link('reset-password/'.$token.'?email='.urlencode((string) $user->getEmailForPasswordReset()));

                $this->notifications->actionEmail(
                    user: $user,
                    title: 'Reset your MurihSpace password',
                    bodyHtml: '<p>Hi '.e($user->name).',</p><p>We received a request to reset the password for your MurihSpace account. Click the button below to choose a new password. This link expires in 60 minutes.</p>',
                    actionLabel: 'Reset Password',
                    actionUrl: $resetUrl,
                    footnote: 'If you did not request a password reset, no further action is required.',
                    template: 'password_reset',
                );
            }
        );

        if ($status === Password::RESET_LINK_SENT) {
            return response()->json([
                'message' => 'Password reset link sent to your email.',
            ]);
        }

        throw ValidationException::withMessages([
            'email' => [__($status)],
        ]);
    }

    public function resetPassword(Request $request): JsonResponse
    {
        $request->validate([
            'token' => ['required', 'string'],
            'email' => ['required', 'string', 'email', 'max:255'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ]);

        $status = Password::reset(
            $request->only('email', 'password', 'password_confirmation', 'token'),
            function ($user, $password) {
                $user->forceFill([
                    'password' => Hash::make($password),
                ])->setRememberToken(Str::random(60));

                $user->save();

                event(new PasswordReset($user));
            }
        );

        if ($status === Password::PASSWORD_RESET) {
            return response()->json([
                'message' => 'Password has been reset successfully.',
            ]);
        }

        throw ValidationException::withMessages([
            'email' => [__($status)],
        ]);
    }
}
