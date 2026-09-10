<?php

namespace App\Enums;

enum PayoutStatus: string
{
    case Pending = 'pending';
    case Processing = 'processing';
    case Successful = 'successful';
    case Failed = 'failed';
    case Cancelled = 'cancelled';
    case Reversed = 'reversed';

    public function isFinal(): bool
    {
        return match ($this) {
            self::Successful, self::Failed, self::Cancelled, self::Reversed => true,
            default => false,
        };
    }
}

