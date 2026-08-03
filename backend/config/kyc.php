<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Active providers
    |--------------------------------------------------------------------------
    | Admin-selected providers (ordered). One or more of: didit | sumsub | manual.
    | Defaults to KYC_PROVIDERS env (comma separated) or the legacy KYC_PROVIDER.
    | The admin can enable any one or several together.
    */
    'providers' => array_filter(array_map(
        fn ($v) => trim($v),
        explode(',', (string) env('KYC_PROVIDERS', env('KYC_PROVIDER', 'manual'))),
    )),

    /*
    |--------------------------------------------------------------------------
    | Gating
    |--------------------------------------------------------------------------
    | Whether sellers/creators/vendors must complete KYC before performing
    | high-risk actions (selling, escrow, payouts, withdrawals).
    */
    'required_for_sellers' => (bool) env('KYC_REQUIRED_FOR_SELLERS', true),

    /*
    |--------------------------------------------------------------------------
    | Session controls
    |--------------------------------------------------------------------------
    */
    'session_rate_limit' => (int) env('KYC_SESSION_RATE_LIMIT', 5),
    'session_rate_limit_minutes' => (int) env('KYC_SESSION_RATE_LIMIT_MINUTES', 60),
    'data_retention_days' => (int) env('KYC_DATA_RETENTION_DAYS', 365),

    /*
    |--------------------------------------------------------------------------
    | Didit provider (ID check + liveness via hosted session)
    |--------------------------------------------------------------------------
    */
    'didit' => [
        'enabled' => (bool) env('DIDIT_ENABLED', false),
        'base_url' => env('DIDIT_BASE_URL', 'https://verification.didit.me'),
        'api_key' => env('DIDIT_API_KEY', ''),
        'client_id' => env('DIDIT_CLIENT_ID', ''),
        'client_secret' => env('DIDIT_CLIENT_SECRET', ''),
        'workflow_id' => env('DIDIT_WORKFLOW_ID', ''),
        'webhook_secret' => env('DIDIT_WEBHOOK_SECRET', ''),
        'callback_url' => env('DIDIT_CALLBACK_URL', ''),
        'sandbox' => (bool) env('DIDIT_SANDBOX', true),
        'timeout' => (int) env('DIDIT_TIMEOUT', 20),
    ],
];
