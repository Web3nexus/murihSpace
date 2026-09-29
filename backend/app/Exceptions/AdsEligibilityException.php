<?php

namespace App\Exceptions;

use RuntimeException;

/**
 * Thrown when a MurihSpace user without a Creator/Vendor/Admin tier tries to
 * use Ads Studio. The controller converts this into a 403 for the caller.
 */
class AdsEligibilityException extends RuntimeException
{
}