<?php

namespace App\Services\Otp;

use App\Models\PhoneOtpRequest;

/**
 * Shows a verification code to whoever is testing a non-production build.
 *
 * The code is written to the process error output only. Coolify shows that in
 * the app's Logs tab. It is never written to the database, the cache, or the
 * application log, so the log redaction and the cache have nothing to leak.
 *
 * Production never prints a code. That is checked first, so no configuration
 * value can turn this on there. Staging turns it on with OTP_DEV_CONSOLE=true.
 * Tests read codes back through codeFor(), which keeps them in memory only.
 */
final class DevOtpConsole
{
    /** @var array<int, string> Codes captured during tests only. */
    private static array $captured = [];

    public static function publish(PhoneOtpRequest $request, string $code): void
    {
        if (! self::enabled()) {
            return;
        }

        if (app()->environment('testing')) {
            self::$captured[$request->id] = $code;

            return;
        }

        error_log(sprintf(
            '[dev-otp] request=%d intent=%s code=%s',
            $request->id,
            $request->intent,
            $code,
        ));
    }

    public static function codeFor(int $requestId): ?string
    {
        return self::$captured[$requestId] ?? null;
    }

    public static function forgetAll(): void
    {
        self::$captured = [];
    }

    private static function enabled(): bool
    {
        if (app()->environment('production')) {
            return false;
        }

        if (app()->environment('testing')) {
            return true;
        }

        return (bool) config('services.otp.dev_console', false);
    }
}
