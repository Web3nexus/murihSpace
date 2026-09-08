<?php

namespace App\Services\Payment\Exceptions;

use Exception;

class PaymentException extends Exception
{
    public function __construct(
        string $message,
        public readonly string $errorCode = 'PAYMENT_FAILED',
        public readonly int $statusCode = 400,
        public readonly array $context = [],
        ?Exception $previous = null,
    ) {
        parent::__construct($message, $statusCode, $previous);
    }
}
