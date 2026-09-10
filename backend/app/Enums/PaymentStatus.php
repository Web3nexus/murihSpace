<?php

namespace App\Enums;

enum PaymentStatus: string
{
    case Pending = 'pending';
    case Processing = 'processing';
    case Successful = 'successful';
    case Failed = 'failed';
    case Cancelled = 'cancelled';
    case Refunded = 'refunded';
    case PartiallyRefunded = 'partially_refunded';
    case Reversed = 'reversed';
    case Expired = 'expired';

    public function isFinal(): bool
    {
        return match ($this) {
            self::Successful, self::Failed, self::Cancelled, self::Refunded, self::Reversed, self::Expired => true,
            default => false,
        };
    }

    public function isSuccessful(): bool
    {
        return $this === self::Successful;
    }
}

