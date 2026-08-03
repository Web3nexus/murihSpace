<?php

namespace App\Enums;

enum KycStatus: string
{
    case Unsubmitted = 'unsubmitted';
    case Pending = 'pending';
    case Verified = 'verified';
    case Rejected = 'rejected';
    case Expired = 'expired';

    public function label(): string
    {
        return match ($this) {
            self::Unsubmitted => 'Not submitted',
            self::Pending => 'In review',
            self::Verified => 'Verified',
            self::Rejected => 'Rejected',
            self::Expired => 'Expired',
        };
    }
}
