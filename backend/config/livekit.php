<?php

return [
    'host' => env('LIVEKIT_HOST', 'http://localhost:7880'),
    'api_key' => env('LIVEKIT_API_KEY', env('APP_ENV') === 'production' ? '' : 'devkey'),
    'api_secret' => env('LIVEKIT_API_SECRET', env('APP_ENV') === 'production' ? '' : 'secret_for_local_dev_1234567890123'),
];
