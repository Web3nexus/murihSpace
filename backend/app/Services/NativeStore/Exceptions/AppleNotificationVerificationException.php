<?php

namespace App\Services\NativeStore\Exceptions;

use RuntimeException;

/**
 * Raised when an App Store Server Notification signedPayload fails JWS
 * verification (bad chain, bad signature, expired certificate, malformed input).
 */
class AppleNotificationVerificationException extends RuntimeException
{
}
