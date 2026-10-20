<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Staff identity sync
    |--------------------------------------------------------------------------
    |
    | Every staff account created, updated, disabled or re-enabled here is
    | pushed to the main MurihSpace backend (the super admin identity hub) via
    | POST {main_url}/internal/staff/sync. The request is authenticated with the
    | shared internal token plus X-Timestamp and X-Nonce, the same scheme the
    | ads SSO exchange uses.
    |
    | Both values are required in production (see AppServiceProvider).
    |
    */

    'main_url' => env('STAFF_SYNC_MAIN_URL'),

    'internal_token' => env('STAFF_SYNC_INTERNAL_TOKEN'),

    'timeout' => (int) env('STAFF_SYNC_TIMEOUT', 10),

];
