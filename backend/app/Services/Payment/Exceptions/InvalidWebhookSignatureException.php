<?php

namespace App\Services\Payment\Exceptions;

class InvalidWebhookSignatureException extends PaymentException
{
    public function __construct(string $provider, string $message = 'Invalid webhook signature.', array $context = [])
    {
        parent::__construct($message, 'INVALID_WEBHOOK_SIGNATURE', 401, array_merge(['provider' => $provider], $context));
    }
}

