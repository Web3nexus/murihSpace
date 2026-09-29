<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Config;

/**
 * Reports exactly why OTP delivery would fail on this server, without leaking
 * any secrets. Mirrors the resolution logic in PhoneOtpService / LogOtpDriver /
 * TwilioOtpDriver so the output corresponds to what /auth/otp/request does.
 */
class OtpDiagnose extends Command
{
    protected $signature = 'otp:diagnose';
    protected $description = 'Show why OTP delivery fails on this server (no secrets printed)';

    public function handle(): int
    {
        $environment = app()->environment();
        $rawDriver = (string) Config::get('services.twilio.otp_driver', 'log');
        $normalised = strtolower(trim($rawDriver));
        if ($normalised === '') {
            $normalised = 'log';
        }

        $this->info('Environment              : '.$environment);
        $this->line('Raw OTP_DRIVER value    : '.($rawDriver === '' ? '(blank)' : $rawDriver));
        $this->line('Normalised driver       : '.$normalised);

        if ($normalised === 'log') {
            $allowLog = filter_var(Config::get('services.twilio.allow_log_driver', false), FILTER_VALIDATE_BOOLEAN);
            $this->line('Allow log driver (prod) : '.($allowLog ? 'true' : 'false'));

            if ($environment === 'production' && ! $allowLog) {
                $this->error('OTP would fail: the log driver is blocked in production. Set OTP_ALLOW_LOG_DRIVER=true to allow staging-style log delivery, or set OTP_DRIVER=twilio with valid Twilio credentials.');
            } elseif ($environment === 'production') {
                $this->warn('OTP will work, but codes are only readable from the app/active devices, never SMS. This is acceptable for a staging clone of production.');
            } else {
                $this->line('OTP will work: codes are readable in the Laravel log.');
            }
        } elseif ($normalised === 'twilio') {
            $presence = [
                'TWILIO_ACCOUNT_SID' => (string) Config::get('services.twilio.account_sid'),
                'TWILIO_AUTH_TOKEN' => (string) Config::get('services.twilio.auth_token'),
                'TWILIO_VERIFY_SERVICE_SID' => (string) Config::get('services.twilio.verify_service_sid'),
            ];
            $missing = array_keys(array_filter($presence, fn (string $v) => $v === ''));

            if ($missing) {
                $this->error('OTP would fail: Twilio Verify is not configured (missing: '.implode(', ', $missing).').');
                $this->line('Set the missing env vars, or set OTP_DRIVER=log to read codes from the log instead.');
            } else {
                $this->line('Twilio Verify credentials are all present (values not shown).');
            }
        } else {
            $this->error("Unknown OTP driver configured: '{$normalised}'. Expected 'twilio' or 'log'.");
        }

        return self::SUCCESS;
    }
}