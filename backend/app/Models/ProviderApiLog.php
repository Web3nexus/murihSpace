<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ProviderApiLog extends Model
{
    protected $fillable = [
        'correlation_id',
        'provider',
        'endpoint',
        'http_method',
        'http_status',
        'duration_ms',
        'is_success',
        'error_code',
        'sanitized_request',
        'sanitized_response',
    ];

    protected $casts = [
        'http_status' => 'integer',
        'duration_ms' => 'integer',
        'is_success' => 'boolean',
        'sanitized_request' => 'array',
        'sanitized_response' => 'array',
    ];
}

