<?php

namespace App\Services\Otp;

use App\Models\PhoneOtpRequest;
use App\Services\Otp\OtpProviderException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

/**
 * Local development / test driver.
 *
 * Generates a 6-digit code, stores only its SHA-256 hash on the request row,
 * logs the code (dev only), and keeps the plaintext code in a short-lived cache
 * key so local flows and automated tests can read it.
 *
 * This driver must never be used in production. It refuses to start when
 * APP_ENV is production, and no configuration flag can override that. Outside
 * production, the code is logged and the cache key is namespaced `phone-otp:dev:`.
 */
class LogOtpDriver implements OtpDriverInterface
{
    public function name(): string
    {
        return 'log';
    }

    public function start(PhoneOtpRequest $request): void
    {
        // Staging and local run this driver so codes can be read from the log
        // instead of sending real SMS. Production never does: a code must not
        // reach any log, so this refuses before a code is generated.
        if (app()->environment('production')) {
            throw new OtpProviderException('The log OTP driver must never be used in production.');
        }

        $code = (string) random_int(100000, 999999);
        $ttlMinutes = (int) config('services.twilio.code_ttl', 10);

        $request->code_hash = hash('sha256', $code);
        $request->code_expires_at = now()->addMinutes($ttlMinutes);

        Log::info('[phone-otp] dev driver verification requested', [
            'phone' => $request->maskedPhone(),
            'intent' => $request->intent,
            'request_id' => $request->id,
            'code' => $code, // non-production only; start() refuses in production
        ]);

        Cache::put('phone-otp:dev:'.$request->id, $code, now()->addMinutes($ttlMinutes));
    }

    public function check(PhoneOtpRequest $request, string $code): array
    {
        if ($request->code_expires_at && $request->code_expires_at->isPast()) {
            return ['status' => 'expired'];
        }

        if ($request->code_hash && hash_equals((string) $request->code_hash, hash('sha256', $code))) {
            return ['status' => 'approved'];
        }

        return ['status' => 'denied'];
    }
}
