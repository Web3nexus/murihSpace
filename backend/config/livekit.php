<?php

// No fallback domains: the host and the keys must come from the environment.
return [
    'host' => env('LIVEKIT_HOST'),
    'api_key' => env('LIVEKIT_API_KEY'),
    'api_secret' => env('LIVEKIT_API_SECRET'),
];
