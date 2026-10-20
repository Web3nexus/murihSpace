<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | MurihSpace SSO
    |--------------------------------------------------------------------------
    */

    'murihspace' => [
        // Browser SSO ("Continue with MurihSpace"). The browser obtains a single-use
        // code from the main API; ads-backend exchanges it server-to-server at
        // {sso_base_url}/internal/ads/sso/exchange with the internal service token.
        // sso_base_url is the main backend ORIGIN (no /api suffix).
        'sso_base_url' => env('MURIHSPACE_SSO_BASE_URL'),
        // Must equal the main backend's INTERNAL_API_TOKEN. Server-side only.
        'internal_token' => env('MURIHSPACE_INTERNAL_TOKEN'),
        // Must equal the main backend's ADS_SSO_REDIRECT_URI (the ads frontend callback).
        'redirect_uri' => env('MURIHSPACE_SSO_REDIRECT_URI'),
    ],

];
