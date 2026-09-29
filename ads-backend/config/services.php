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
    |
    | The core MurihSpace app signs ad-studio SSO tokens with its own APP_KEY
    | (the literal `base64:...` string). Ads Studio must trust the exact same
    | string to verify them. It is a cross-service trust secret and therefore
    | has NO default: when it is unset every SSO attempt is rejected rather
    | than silently falling back to a value that ships in the repository.
    */

    'murihspace' => [
        'app_key' => env('MURIHSPACE_APP_KEY'),
    ],

];
