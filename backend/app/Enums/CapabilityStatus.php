<?php

namespace App\Enums;

enum CapabilityStatus: string
{
    case Confirmed = 'CONFIRMED';
    case NotAvailable = 'NOT AVAILABLE';
    case RequiresApproval = 'REQUIRES APPROVAL';
    case Unknown = 'UNKNOWN / NEEDS PROVIDER CONFIRMATION';

    public function isOperable(): bool
    {
        return $this === self::Confirmed;
    }
}
