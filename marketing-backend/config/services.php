<?php

$validateUrl = function (string $url) {
    if (env('APP_ENV') !== 'local' && str_starts_with($url, 'http://') && !str_starts_with($url, 'http://127.0.0.1') && !str_starts_with($url, 'http://localhost')) {
        throw new RuntimeException("Service URL must use HTTPS outside local development: {$url}");
    }
    return $url;
};

return [

    /*
    |--------------------------------------------------------------------------
    | Ticket Service
    |--------------------------------------------------------------------------
    |
    | The main application (web/backend) is the only consumer of the
    | customer-facing ticket API exposed by this service. Requests from that
    | application must present this shared secret via the `X-Internal-Token`
    | header, proving the caller is trusted to act on behalf of its own
    | authenticated users.
    |
    */

    'ticket_service' => [
        'base_url' => rtrim($validateUrl((string) env('TICKET_SERVICE_BASE_URL', 'http://127.0.0.1:8001')), '/'),
        'internal_token' => env('TICKET_SERVICE_INTERNAL_TOKEN', ''),
    ],

    /*
    |--------------------------------------------------------------------------
    | Main application internal API
    |--------------------------------------------------------------------------
    |
    | The main application (web/backend) exposes a restricted service-to-service
    | API under `/internal/support/*` that this service calls to fetch
    | user/order/subscription/wallet/KYC context while helping customers. Calls
    | must be signed with the shared `INTERNAL_API_TOKEN` plus a timestamp and a
    | fresh nonce (see MainBackendService).
    |
    */

    'main_backend' => [
        'base_url' => rtrim($validateUrl((string) env('MAIN_BACKEND_INTERNAL_URL', 'http://127.0.0.1:8000')), '/'),
        'token' => env('MAIN_BACKEND_INTERNAL_TOKEN', ''),
    ],

];
