<?php

return [

    'paths' => ['api/*', 'sanctum/csrf-cookie', 'broadcasting/auth'],

    'allowed_methods' => ['*'],

    'allowed_origins' => array_values(array_filter(array_map('trim', explode(',', (string) env('CORS_ALLOWED_ORIGINS', 'http://localhost:5173,http://localhost:3000,https://web.murihspace.com,https://staging.murihspace.com,https://app-staging.murihspace.com,https://murihspace.com,https://ads.murihspace.com,https://graph.murihspace.com'))))),

    'allowed_origins_patterns' => [
        '#^https?://.*\.murihspace\.com$#',
        '#^http://localhost(:[0-9]+)?$#',
        '#^http://127\.0\.0\.1(:[0-9]+)?$#',
    ],

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 0,

    'supports_credentials' => env('CORS_SUPPORTS_CREDENTIALS', true),

];
