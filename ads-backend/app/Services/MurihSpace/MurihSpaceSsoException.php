<?php

namespace App\Services\MurihSpace;

use RuntimeException;

/** A failed SSO step. The message is a machine-readable reason, never user data. */
class MurihSpaceSsoException extends RuntimeException
{
}
