<?php

return [
    // An account is suspended automatically when this many distinct people report it
    // within the window below. Reports that a moderator dismissed do not count.
    'auto_suspend' => [
        'reporters' => (int) env('MODERATION_AUTO_SUSPEND_REPORTERS', 3),
        'window_days' => (int) env('MODERATION_AUTO_SUSPEND_WINDOW_DAYS', 7),
    ],
];
