<?php

namespace App\Services\NativeStore\Exceptions;

use RuntimeException;

/**
 * Raised when a native store purchase cannot be verified or fulfilled.
 * Message is user-safe and surfaces as a 422 NATIVE_VERIFY_FAILED response.
 */
class StoreVerificationException extends RuntimeException
{
}