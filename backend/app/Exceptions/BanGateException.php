<?php

namespace App\Exceptions;

use RuntimeException;

/**
 * Thrown by UserEnforcementService when a ban is attempted on a member
 * who does not satisfy the ban preconditions (e.g. no active warning on file
 * for a standard ban).
 */
class BanGateException extends RuntimeException
{
}
