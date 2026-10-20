<?php

namespace App\Services\Staff;

use RuntimeException;

/** A refused staff token. The message is a machine-readable reason, never token content. */
class StaffHubTokenException extends RuntimeException
{
}
