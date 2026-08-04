<?php

namespace App\Services\Otp;

use App\Models\PhoneOtpRequest;

interface OtpDriverInterface
{
    public function name(): string;

    /**
     * Start a verification for the given request. The driver is responsible for
     * persisting whatever it needs on the request (e.g. twilio_sid) and any
     * derived state (code expiry). Must throw OtpProviderException on failure.
     */
    public function start(PhoneOtpRequest $request): void;

    /**
     * Check the user-supplied code.
     *
     * @return array{status: 'approved'|'denied'|'expired'|'max_attempts'}
     */
    public function check(PhoneOtpRequest $request, string $code): array;
}
