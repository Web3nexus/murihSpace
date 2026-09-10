<?php

namespace App\Services\Payment\Exceptions;

class RoutingException extends PaymentException
{
    public function __construct(string $message = 'No viable payment provider found for this transaction.', array $context = [])
    {
        parent::__construct($message, 'NO_PROVIDER_AVAILABLE', 422, $context);
    }
}

