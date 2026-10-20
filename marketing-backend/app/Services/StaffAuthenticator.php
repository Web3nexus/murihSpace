<?php

namespace App\Services;

use App\Models\StaffUser;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/**
 * Password check for the staff API with account lockout.
 *
 * Rules:
 *  - N consecutive wrong passwords (config staff.lockout.max_attempts) lock the
 *    account for staff.lockout.lock_minutes. While locked, no password is checked.
 *  - A successful password check resets the counter.
 *  - Disabled accounts are checked like any other, then refused.
 *  - Unknown emails still spend a bcrypt check so response timing does not reveal
 *    whether an account exists.
 *
 * Failures are logged with a reason but never with the password.
 */
class StaffAuthenticator
{
    private static ?string $dummyHash = null;

    public function attempt(string $email, string $password, Request $request): ?StaffUser
    {
        $email = Str::lower(trim($email));
        $ip = $request->ip();

        $staff = StaffUser::query()->where('email', $email)->first();

        if ($staff === null) {
            Hash::check($password, self::dummyHash());
            $this->fail($email, 'unknown_email', $ip);

            return null;
        }

        if ($staff->isLocked()) {
            $this->fail($email, 'locked', $ip, $staff);

            return null;
        }

        if (! Hash::check($password, $staff->password)) {
            $this->registerFailedAttempt($staff);
            $this->fail($email, 'bad_password', $ip, $staff);

            return null;
        }

        if (! $staff->isActive()) {
            $this->fail($email, 'disabled', $ip, $staff);

            return null;
        }

        $staff->forceFill([
            'failed_login_attempts' => 0,
            'locked_until' => null,
            'last_login_at' => now(),
            'last_login_ip' => $ip,
        ])->save();

        Log::info('staff.api.login.succeeded', ['staff_id' => $staff->id, 'ip' => $ip]);

        return $staff;
    }

    private function registerFailedAttempt(StaffUser $staff): void
    {
        $max = (int) config('staff.lockout.max_attempts', 5);
        $attempts = (int) $staff->failed_login_attempts + 1;

        $staff->forceFill([
            'failed_login_attempts' => $attempts,
            'locked_until' => $attempts >= $max
                ? now()->addMinutes((int) config('staff.lockout.lock_minutes', 15))
                : null,
        ])->save();
    }

    private function fail(string $email, string $reason, ?string $ip, ?StaffUser $staff = null): void
    {
        Log::warning('staff.api.login.failed', [
            'email' => $email,
            'staff_id' => $staff?->id,
            'reason' => $reason,
            'ip' => $ip,
        ]);
    }

    private static function dummyHash(): string
    {
        return self::$dummyHash ??= Hash::make(Str::random(32));
    }
}
