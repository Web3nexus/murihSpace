<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Default Currency and Minor Unit Conversion
    |--------------------------------------------------------------------------
    */
    'default_currency' => env('DEFAULT_CURRENCY', 'USD'),

    /*
    |--------------------------------------------------------------------------
    | Provider Configurations
    |--------------------------------------------------------------------------
    | Sensitive credentials MUST be loaded strictly via environment variables.
    | Client-safe public keys are explicitly flagged.
    */
    'providers' => [
        'airwallex' => [
            'enabled' => env('AIRWALLEX_ENABLED', false),
            'environment' => env('AIRWALLEX_ENV', 'sandbox'), // sandbox or production
            'client_id' => env('AIRWALLEX_CLIENT_ID'),
            'api_key' => env('AIRWALLEX_API_KEY'),
            'webhook_secret' => env('AIRWALLEX_WEBHOOK_SECRET'),
            'base_url' => env('AIRWALLEX_ENV', 'sandbox') === 'production'
                ? 'https://api.airwallex.com/api/v1'
                : 'https://api-demo.airwallex.com/api/v1',
            'timeout' => (int) env('AIRWALLEX_TIMEOUT', 30),
        ],

        'paystack' => [
            'enabled' => env('PAYSTACK_ENABLED', false),
            'environment' => env('PAYSTACK_ENV', 'test'), // test or live
            'public_key' => env('PAYSTACK_PUBLIC_KEY'),
            'secret_key' => env('PAYSTACK_SECRET_KEY'),
            'base_url' => 'https://api.paystack.co',
            'timeout' => (int) env('PAYSTACK_TIMEOUT', 30),
        ],

        'flutterwave' => [
            'enabled' => env('FLUTTERWAVE_ENABLED', false),
            'environment' => env('FLUTTERWAVE_ENV', 'sandbox'), // sandbox or live
            'public_key' => env('FLUTTERWAVE_PUBLIC_KEY'),
            'secret_key' => env('FLUTTERWAVE_SECRET_KEY'),
            'encryption_key' => env('FLUTTERWAVE_ENCRYPTION_KEY'),
            'webhook_secret_hash' => env('FLUTTERWAVE_WEBHOOK_SECRET_HASH'),
            'base_url' => 'https://api.flutterwave.com/v3',
            'timeout' => (int) env('FLUTTERWAVE_TIMEOUT', 30),
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | Webhooks & Security
    |--------------------------------------------------------------------------
    */
    'webhooks' => [
        'tolerance_seconds' => (int) env('PAYMENT_WEBHOOK_TOLERANCE', 300),
        'queue_name' => env('PAYMENT_WEBHOOK_QUEUE', 'payments'),
    ],

    /*
    |--------------------------------------------------------------------------
    | Circuit Breaker & Health Monitoring
    |--------------------------------------------------------------------------
    */
    'health' => [
        'failure_threshold' => 5, // Consecutive failures before auto-degrading
        'cooldown_minutes' => 15,
    ],
];

