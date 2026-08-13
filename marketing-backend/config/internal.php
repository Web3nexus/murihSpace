<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Internal API Token
    |--------------------------------------------------------------------------
    |
    | Shared secret used to authenticate machine-to-machine requests from the
    | main application (web/backend) to this service's customer-facing ticket
    | API. The caller presents the token in the `X-Internal-Token` header and
    | identifies the customer via `X-Customer-Email`.
    |
    */

    'token' => env('INTERNAL_API_SECRET', ''),

];
