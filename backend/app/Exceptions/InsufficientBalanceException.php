<?php

namespace App\Exceptions;

use Exception;

/**
 * Thrown when a wallet does not have enough available balance to cover a
 * transaction. Rendered as a 422 response so clients can surface a
 * top-up prompt instead of a generic 500.
 */
class InsufficientBalanceException extends Exception
{
    public const CODE = 'INSUFFICIENT_BALANCE';
}
