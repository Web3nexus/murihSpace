<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Advertiser dashboard (frontend) URL
    |--------------------------------------------------------------------------
    |
    | Where SSO sign-in redirects the browser after the callback. Required in
    | production (checked at boot); there is no fallback domain.
    */

    'frontend_url' => env('FRONTEND_URL'),

    /*
    |--------------------------------------------------------------------------
    | Staff (admin) sign-in from the marketing hub
    |--------------------------------------------------------------------------
    |
    | The marketing hub issues short-lived HMAC-signed staff tokens, verified
    | with this shared secret (ADS_STAFF_HUB_SECRET). Required in production.
    | When unset, staff sign-in is refused and no admin session is created.
    */

    'staff_hub_secret' => env('ADS_STAFF_HUB_SECRET'),

    // Hub roles that may get an ads admin session.
    'staff_roles' => ['admin', 'moderator'],

    // Lifetime of the ads admin session created from a verified staff token.
    'staff_session_minutes' => (int) env('ADS_STAFF_SESSION_MINUTES', 480),

];
