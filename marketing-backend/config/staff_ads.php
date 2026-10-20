<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Ads staff hub secret
    |--------------------------------------------------------------------------
    |
    | Shared HMAC-SHA256 key with the ads backend (its ADS_STAFF_HUB_SECRET).
    | The hub signs short-lived staff tokens with it; the ads backend verifies
    | them at POST /api/auth/staff/hub-session. Never commit a value. Required in
    | production (see AppServiceProvider).
    |
    */

    'hub_secret' => env('ADS_STAFF_HUB_SECRET'),

    /*
    |--------------------------------------------------------------------------
    | Token lifetime
    |--------------------------------------------------------------------------
    |
    | Seconds between issue and expiry. The ads backend rejects anything over
    | 300 seconds, so the issuer clamps this to 1..300.
    |
    */

    'token_ttl_seconds' => (int) env('ADS_STAFF_TOKEN_TTL_SECONDS', 120),

    /*
    |--------------------------------------------------------------------------
    | Marketing role => ads role
    |--------------------------------------------------------------------------
    |
    | Only these marketing roles may receive an ads token, and each one only
    | for its matching ads role. Ads roles are the ones the ads backend accepts
    | (config/ads.php staff_roles).
    |
    */

    'roles' => [
        'super_admin' => 'admin',
        'content_manager' => 'moderator',
    ],

];
