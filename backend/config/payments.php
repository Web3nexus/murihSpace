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

        'paddle' => [
            'enabled' => env('PADDLE_ENABLED', false),
            'environment' => env('PADDLE_ENV', 'sandbox'), // sandbox or production
            // Paddle "Merchant of Record": when true the provider collects/remits
            // VAT/sales tax itself, so MurihSpace must NOT compute its own tax.
            'handles_tax' => (bool) env('PADDLE_HANDLES_TAX', true),
            'vendor_id' => env('PADDLE_VENDOR_ID'),
            'client_token' => env('PADDLE_CLIENT_TOKEN'), // Client-side token (checkout SDK)
            'api_key' => env('PADDLE_API_KEY'),
            'webhook_secret' => env('PADDLE_WEBHOOK_SECRET'),
            'webhook_public_key' => env('PADDLE_WEBHOOK_PUBLIC_KEY'),
            'base_url' => env('PADDLE_ENV', 'sandbox') === 'production'
                ? 'https://api.paddle.com'
                : 'https://sandbox-api.paddle.com',
            'timeout' => (int) env('PADDLE_TIMEOUT', 30),
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | Native Store (In-App Purchase) Billing
    |--------------------------------------------------------------------------
    | In-app purchases are verified server-to-server against the app stores and
    | NEVER route through an online payment provider (Paddle has no role here):
    |   - Apple: App Store receipt validation (verifyReceipt) with sandbox fallback.
    |   - Google: Play Developer API (androidpublisher) purchases.products.get.
    | Coin packs map to a store product id: pack->store_product_<platform> or
    | the configured prefix + total coins (e.g. com.murihspace.coins.275).
    */
    'stores' => [
        'product_prefix' => env('NATIVE_STORE_PRODUCT_PREFIX', 'com.murihspace.coins.'),

        'apple' => [
            'enabled' => (bool) env('APPLE_STORE_ENABLED', false),
            'environment' => env('APPLE_STORE_ENV', 'sandbox'), // sandbox or production
            'bundle_id' => env('APPLE_STORE_BUNDLE_ID', 'com.murihspace.app'),
            'shared_secret' => env('APPLE_STORE_SHARED_SECRET'), // App Store Connect shared secret (verifyReceipt)
            'verify_receipt_url' => 'https://buy.itunes.apple.com/verifyReceipt',
            'verify_receipt_sandbox_url' => 'https://sandbox.itunes.apple.com/verifyReceipt',
            'webhook_token' => env('APPLE_WEBHOOK_TOKEN'),
            'timeout' => (int) env('APPLE_STORE_TIMEOUT', 30),
        ],

        'google' => [
            'enabled' => (bool) env('GOOGLE_PLAY_ENABLED', false),
            'package_name' => env('GOOGLE_PLAY_PACKAGE_NAME', 'com.murihspace.app'),
            'client_email' => env('GOOGLE_PLAY_CLIENT_EMAIL'),
            'private_key' => env('GOOGLE_PLAY_PRIVATE_KEY'), // escaped PEM, or path via service_account_json
            'service_account_json' => env('GOOGLE_PLAY_SERVICE_ACCOUNT_JSON'), // path or inline JSON
            'token_url' => 'https://oauth2.googleapis.com/token',
            'publisher_api_base' => 'https://androidpublisher.googleapis.com/androidpublisher/v3',
            'webhook_token' => env('GOOGLE_PLAY_WEBHOOK_TOKEN'),
            'timeout' => (int) env('GOOGLE_PLAY_TIMEOUT', 30),
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

