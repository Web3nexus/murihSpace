<?php

namespace App\Enums;

enum ProviderHealthStatus: string
{
    case Healthy = 'healthy';
    case Degraded = 'degraded';
    case Down = 'down';
    case Maintenance = 'maintenance';
}

