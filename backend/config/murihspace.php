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
];
