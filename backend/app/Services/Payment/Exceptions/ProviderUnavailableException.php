<?php

namespace App\Services\Payment\Exceptions;

class ProviderUnavailableException extends PaymentException
{
    public function __construct(string $provider, string $message = 'Payment provider is currently unavailable.', array $context = [])
    {
        parent::__construct($message, 'PROVIDER_UNAVAILABLE', 503, array_merge(['provider' => $provider], $context));
    }
}

