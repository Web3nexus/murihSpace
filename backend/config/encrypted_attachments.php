<?php

return [

    /*
    | Disk holding ciphertext objects. Must be a private bucket.
    */
    'disk' => env('ENCRYPTED_ATTACHMENT_DISK', 'contabo_private'),

    /*
    | Maximum ciphertext size per upload, in bytes. Ciphertext is roughly the
    | plaintext size plus a 16-byte GCM tag. Default: 25 MB.
    */
    'max_bytes' => (int) env('ENCRYPTED_ATTACHMENT_MAX_BYTES', 25 * 1024 * 1024),

    /*
    | Maximum number of encrypted attachments a single user may upload per
    | rolling 24 hours (count limit).
    */
    'daily_upload_limit' => (int) env('ENCRYPTED_ATTACHMENT_DAILY_LIMIT', 200),

    /*
    | Lifetime of signed download URLs, in minutes.
    */
    'url_ttl_minutes' => (int) env('ENCRYPTED_ATTACHMENT_URL_TTL', 5),

];
