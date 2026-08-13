<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Internal Service API
    |--------------------------------------------------------------------------
    |
    | Restricted service-to-service API consumed by trusted internal services
    | (e.g. the marketing-backend support system). These routes are never
    | exposed publicly. Every request must present:
    |
    |   - `X-Internal-Token`   the shared service secret
    |   - `X-Timestamp`        unix timestamp within the replay window
    |   - `X-Nonce`            a unique value used once for replay protection
    |
    | Optionally restrict callers to an allow-list of source IPs.
    |
    */

    'token' => env('INTERNAL_API_TOKEN', ''),

    // Replay protection window, in seconds. Requests older (or further in the
    // future) than this are rejected.
    'replay_window' => (int) env('INTERNAL_API_REPLAY_WINDOW', 300),

    // Optional allow-list of source IPs. Empty array = allow all.
    'allowed_ips' => array_values(array_filter(array_map(
        'trim',
        explode(',', (string) env('INTERNAL_API_ALLOWED_IPS', '')),
    ))),

    // Default rate limit: max attempts per window per service token.
    'rate_limit' => [
        'attempts' => (int) env('INTERNAL_API_RATE_LIMIT', 300),
        'decay' => (int) env('INTERNAL_API_RATE_DECAY', 60),
    ],

    // Scopes this service token may access. Currently a single service token
    // exists; scope enforcement keeps future multi-service setups possible.
    'scopes' => array_values(array_filter(array_map(
        'trim',
        explode(',', (string) env('INTERNAL_API_SCOPES', 'support:read')),
    ))),

];
