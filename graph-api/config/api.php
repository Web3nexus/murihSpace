<?php

return [
    // -----------------------------------------------------------------------
    // Downstream service base URLs
    // -----------------------------------------------------------------------
    'main_base_url'       => env('MAIN_API_BASE_URL',       'https://api.murihspace.com/api'),
    'ads_base_url'        => env('ADS_API_BASE_URL',        'https://ads.murihspace.com/api'),
    'marketing_base_url'  => env('MARKETING_API_BASE_URL',  'https://murihspace.com/api'),

    // -----------------------------------------------------------------------
    // Service-to-service tokens (short-lived JWTs or static secrets per env)
    // -----------------------------------------------------------------------
    'main_service_token'      => env('MAIN_API_SERVICE_TOKEN',      ''),
    'ads_service_token'       => env('ADS_API_SERVICE_TOKEN',       ''),
    'marketing_service_token' => env('MARKETING_API_SERVICE_TOKEN', ''),

    // -----------------------------------------------------------------------
    // Rate limiting defaults (requests per minute)
    // -----------------------------------------------------------------------
    'rate_limit' => [
        'anonymous'     => (int) env('GRAPH_RATE_LIMIT_ANONYMOUS',     60),
        'authenticated' => (int) env('GRAPH_RATE_LIMIT_AUTHENTICATED', 200),
        'service'       => (int) env('GRAPH_RATE_LIMIT_SERVICE',       500),
    ],

    // -----------------------------------------------------------------------
    // CORS — never use '*' for authenticated APIs
    // -----------------------------------------------------------------------
    'allowed_origins' => array_filter(
        explode(',', env('GRAPH_API_ALLOWED_ORIGINS', 'https://web.murihspace.com,https://murihspace.com,https://ads.murihspace.com,http://localhost:3000,http://localhost:5173'))
    ),
];

