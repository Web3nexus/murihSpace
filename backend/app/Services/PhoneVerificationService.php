<?php

namespace App\Services;

use App\Models\PhoneChangeRequest;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class PhoneVerificationService
{
    public function __construct(
        private readonly NotificationService $notifications,
        private readonly SmsEngineService $smsService,
    ) {}

    /**
     * Normalizes a phone number to standard E.164 format.
     */
    public function normalizePhone(string $phone): string
    {
        $cleaned = preg_replace('/[^\d+]/', '', trim($phone));
        if (! str_starts_with($cleaned, '+')) {
            $cleaned = '+' . $cleaned;
        }

        if (! preg_match('/^\+[1-9]\d{6,14}$/', $cleaned)) {
            throw ValidationException::withMessages([
                'phone' => ['Invalid phone number format. Please provide a valid international number in E.164 format (e.g. +2348012345678).'],
            ]);
        }

        return $cleaned;
    }

    /**
     * Initiates a phone number change request for an authenticated user.
     */
    public function initiatePhoneChange(User $user, string $rawPhone): PhoneChangeRequest
    {
        $normalized = $this->normalizePhone($rawPhone);

        // Check if phone already belongs to this user
        if ($user->mobile_number === $normalized) {
            throw ValidationException::withMessages([
                'phone' => ['The new phone number is identical to your current phone number.'],
            ]);
        }

        // Check if phone belongs to another account
        $exists = User::where('mobile_number', $normalized)
            ->where('id', '!=', $user->id)
            ->exists();

        if ($exists) {
            throw ValidationException::withMessages([
                'phone' => ['This phone number is already registered to another account.'],
            ]);
        }

        // Rate limit: check if a pending request was made in the last 60 seconds
        $recent = PhoneChangeRequest::where('user_id', $user->id)
            ->where('created_at', '>=', now()->subSeconds(60))
            ->first();

        if ($recent) {
            throw ValidationException::withMessages([
                'phone' => ['Please wait 60 seconds before requesting another verification code.'],
            ]);
        }

        // Expire older pending requests
        PhoneChangeRequest::where('user_id', $user->id)
            ->where('status', 'pending')
            ->update(['status' => 'expired']);

        // Generate 6-digit numeric OTP code
        $code = (string) random_int(100000, 999999);
        $codeHash = hash('sha256', $code);

        $request = PhoneChangeRequest::create([
            'user_id' => $user->id,
            'old_phone' => $user->mobile_number,
            'new_phone_e164' => $normalized,
            'verification_code_hash' => $codeHash,
            'status' => 'pending',
            'attempts' => 0,
            'expires_at' => now()->addMinutes(10),
        ]);

        // Send OTP via SMS service
        try {
            $this->smsService->send($normalized, "Your MurihSpace verification code is: {$code}. Valid for 10 minutes.");
        } catch (\Throwable $e) {
            report($e);
        }

        return $request;
    }

    /**
     * Verifies the OTP challenge and atomically updates the user's phone number.
     */
    public function verifyAndCommitPhoneChange(User $user, string $code): User
    {
        $request = PhoneChangeRequest::where('user_id', $user->id)
            ->where('status', 'pending')
            ->where('expires_at', '>', now())
            ->latest()
            ->first();

        if (! $request) {
            throw ValidationException::withMessages([
                'code' => ['No active phone change request found or the verification code has expired. Please request a new code.'],
            ]);
        }

        if ($request->attempts >= 5) {
            $request->update(['status' => 'failed']);
            throw ValidationException::withMessages([
                'code' => ['Maximum verification attempts exceeded. Please start over.'],
            ]);
        }

        $request->increment('attempts');

        $inputHash = hash('sha256', trim($code));
        if (! hash_equals($request->verification_code_hash, $inputHash)) {
            throw ValidationException::withMessages([
                'code' => ['The verification code entered is incorrect. (' . (5 - $request->attempts) . ' attempts remaining)'],
            ]);
        }

        // Atomic update inside database transaction
        DB::transaction(function () use ($user, $request) {
            $request->update([
                'status' => 'completed',
                'verified_at' => now(),
                'completed_at' => now(),
            ]);

            $user->update([
                'mobile_number' => $request->new_phone_e164,
                'phone_verified_at' => now(),
            ]);
        });

        // Send security notice to user's email if present
        try {
            if ($user->email) {
                $this->notifications->actionEmail(
                    user: $user,
                    title: 'Security Alert: Phone Number Updated',
                    bodyHtml: "<p>Hello {$user->name},</p><p>Your account's registered mobile number was successfully changed to <strong>{$request->new_phone_e164}</strong> on " . now()->toFormattedDateString() . ".</p><p>If you did not perform this change, please secure your account immediately.</p>",
                    actionLabel: 'Security Settings',
                    actionUrl: NotificationService::link('app'),
                    template: 'security_alert',
                );
            }
        } catch (\Throwable $e) {
            report($e);
        }

        return $user->fresh();
    }
}
