<?php

return [
    /*
    | Platform-wide settings
    */
    'min_payout' => env('MURIHSPACE_MIN_PAYOUT', 1000),

    /*
    | Verified badge — one-time activation fee paid monthly (in platform tokens).
    | Charged from the user's wallet balance.
    */
    'verification_badge_fee' => (int) env('MURIHSPACE_VERIFICATION_BADGE_FEE', 100),

    /*
    | Chat
    */
    'chat' => [
        /*
        | How long a sender may correct their own message after sending it.
        | Recommended range is 60-180 seconds. Set to 0 to disable editing
        | entirely; the server is the only authority on the window.
        */
        'edit_window_seconds' => (int) env('MURIHSPACE_CHAT_EDIT_WINDOW_SECONDS', 120),

        /*
        | Maximum characters an edited message may contain.
        */
        'edit_max_length' => (int) env('MURIHSPACE_CHAT_EDIT_MAX_LENGTH', 5000),
    ],
];
