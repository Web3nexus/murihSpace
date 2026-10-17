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
    | Canonical public profile domain — the host of vanity links such as
    | https://murih.me/@user. Drives verification-badge metadata and admin
    | settings, so staging and live can advertise different hosts. Keep the
    | host bare (no scheme); the URL is assembled elsewhere.
    */
    'canonical_profile_domain' => env('CANONICAL_PROFILE_DOMAIN', (function () {
        $appUrl = (string) env('APP_URL', '');
        $frontendUrl = (string) env('FRONTEND_URL', '');
        if (str_contains($appUrl, 'staging') || str_contains($frontendUrl, 'staging')) {
            $host = parse_url($frontendUrl, PHP_URL_HOST);
            return $host ?: 'staging.murihspace.com';
        }
        if (env('APP_ENV') === 'local') {
            $host = parse_url($frontendUrl, PHP_URL_HOST);
            return $host ?: 'localhost:5173';
        }
        return 'murih.me';
    })()),

    /*
    | QR / device-linking login.
    |
    | The desktop starts a transaction, renders a QR code, and polls for the
    | result; the signed-in mobile app scans and approves it. Transactions are
    | deliberately short-lived and single-use.
    */
    'qr_login' => [
        // Seconds a transaction stays open before it must be restarted.
        'ttl' => (int) env('MURIHSPACE_QR_LOGIN_TTL', 120),

        // Base URL used to build the deep link encoded into the QR image. The
        // mobile scanner accepts this custom scheme; the web URL is a fallback.
        'web_url' => rtrim((string) env('FRONTEND_URL', 'https://web.murihspace.com'), '/'),
    ],

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

        /*
        | Time window (in minutes) during which a sender can delete an unread
        | message for everyone. Once this window passes or the recipient reads it,
        | the message can only be deleted locally (for me).
        */
        'delete_everyone_window_minutes' => (int) env('MURIHSPACE_CHAT_DELETE_WINDOW_MINUTES', 15),
    ],
];
