<?php

namespace App\Support;

use Illuminate\Contracts\Support\Arrayable;
use Monolog\LogRecord;

/**
 * Central masking for log text and log context.
 *
 * Only ever applied to log output (via the Monolog processor in
 * App\Logging\RedactSensitiveLogs) and to log strings built by hand. It must
 * never be applied to data that feeds business logic or API responses.
 */
final class LogRedactor
{
    private const MASK = '***';

    private const MAX_DEPTH = 12;

    /**
     * Normalized (lowercase, '-' => '_') keys whose values are always masked.
     */
    private const SENSITIVE_KEYS = [
        'password',
        'password_confirmation',
        'token',
        'access_token',
        'refresh_token',
        'secret',
        'pin',
        'otp',
        'code',
        'authorization',
        'cookie',
        'card',
        'card_number',
        'cvv',
        'cvc',
        'mobile_number',
        'phone',
        'phone_number',
        'email',
    ];

    /**
     * Keys for which the last four characters stay readable (helps support
     * staff match a card or phone without seeing the full value).
     */
    private const KEEP_LAST_FOUR_KEYS = [
        'card',
        'card_number',
        'cvv',
        'cvc',
        'mobile_number',
        'phone',
        'phone_number',
    ];

    /**
     * Recursively mask sensitive keys inside arrays and Arrayable objects, and
     * scrub Bearer tokens inside string values.
     */
    public static function redact(mixed $value, int $depth = 0): mixed
    {
        if ($depth > self::MAX_DEPTH) {
            return self::MASK;
        }

        if (is_string($value)) {
            return self::scrubBearer($value);
        }

        if ($value instanceof Arrayable) {
            $value = $value->toArray();
        }

        if (! is_array($value)) {
            return $value;
        }

        $out = [];

        foreach ($value as $key => $item) {
            if (is_string($key) && self::isSensitiveKey($key)) {
                $out[$key] = $item === null ? null : self::maskValue($key, $item);

                continue;
            }

            $out[$key] = self::redact($item, $depth + 1);
        }

        return $out;
    }

    public static function isSensitiveKey(string $key): bool
    {
        $normalized = strtolower(str_replace('-', '_', $key));

        if (in_array($normalized, self::SENSITIVE_KEYS, true)) {
            return true;
        }

        return str_ends_with($normalized, '_token')
            || str_contains($normalized, 'password')
            || str_contains($normalized, 'secret')
            || str_contains($normalized, 'api_key')
            || str_contains($normalized, 'apikey');
    }

    /**
     * Replace Bearer credentials anywhere in a string.
     */
    public static function scrubBearer(string $text): string
    {
        return (string) preg_replace('/\bBearer\s+[A-Za-z0-9\-._~+\/]+=*/i', 'Bearer '.self::MASK, $text);
    }

    /**
     * Mask runs of 4 to 8 digits (OTP / verification code shaped values) in free text.
     */
    public static function maskCodes(string $text): string
    {
        return (string) preg_replace('/\b\d{4,8}\b/', self::MASK, $text);
    }

    /**
     * Keep only the last four digits of a phone number for log text.
     */
    public static function maskPhone(string $phone): string
    {
        return strlen($phone) > 4 ? self::MASK.substr($phone, -4) : self::MASK;
    }

    /**
     * Monolog processor body: redacts message, context and extra of a record.
     */
    public static function processRecord(LogRecord $record): LogRecord
    {
        return $record->with(
            message: self::scrubBearer($record->message),
            context: self::redact($record->context),
            extra: self::redact($record->extra),
        );
    }

    private static function maskValue(string $key, mixed $value): string
    {
        if (is_array($value) || is_object($value)) {
            return self::MASK;
        }

        $string = (string) $value;
        $normalized = strtolower(str_replace('-', '_', $key));

        if (in_array($normalized, self::KEEP_LAST_FOUR_KEYS, true) && strlen($string) > 4) {
            return self::MASK.substr($string, -4);
        }

        return self::MASK;
    }
}
