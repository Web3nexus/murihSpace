<?php

return [
    'enabled' => env('SUMSUB_ENABLED', false),
    'base_url' => env('SUMSUB_BASE_URL', 'https://api.sumsub.com'),
    'app_token' => env('SUMSUB_APP_TOKEN', ''),
    'secret_key' => env('SUMSUB_SECRET_KEY', ''),
    'webhook_secret' => env('SUMSUB_WEBHOOK_SECRET', ''),
    'level_name' => env('SUMSUB_LEVEL_NAME', 'basic-kyc-level'),
    'token_ttl' => (int) env('SUMSUB_TOKEN_TTL', 600),
];
