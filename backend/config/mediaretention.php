<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Media retention
    |--------------------------------------------------------------------------
    |
    | Server chat media is automatically deleted after the configured retention
    | window to control storage cost. Message records are always preserved.
    |
    | All values here are overridable at runtime by administrators through
    | Admin → Platform Settings → Messaging Retention (stored in admin_settings).
    | They must never be hardcoded in controllers or the frontend.
    |
    */

    // Default retention window for chat media in days. Sprint default: 7 days.
    'default_retention_days' => (int) env('MEDIA_RETENTION_DAYS', 7),

    // Hard upper cap administrators cannot exceed.
    'max_retention_days' => (int) env('MEDIA_MAX_RETENTION_DAYS', 365),

    // Master switch for the scheduled deletion job.
    'enable_automatic_deletion' => (bool) env('MEDIA_AUTO_DELETE', true),

    // Show "Available for X more days" warnings to users.
    'enable_user_download_warning' => (bool) env('MEDIA_EXPIRY_WARNING', true),

    // Days before expiry when a download-warning notification is triggered.
    'warning_days' => (int) env('MEDIA_EXPIRY_WARNING_DAYS', 3),

    // How many media rows the cleanup command processes per run.
    'batch_size' => (int) env('MEDIA_DELETION_BATCH_SIZE', 200),

    // Time of day the deletion job runs (24h "HH:MM").
    'schedule_time' => env('MEDIA_DELETION_SCHEDULE', '03:00'),

    // Per-media-type overrides (null → fall back to default_retention_days).
    // Keys: image, video, voice, file, gif.
    'retention_by_type' => [
        'image' => null,
        'video' => null,
        'voice' => null,
        'file' => null,
        'gif' => null,
    ],

    // Automatic retention holds that block deletion while active.
    'holds' => [
        'reported' => true,   // subject of an active moderation report
        'dispute' => true,    // explicit dispute hold
        'order' => true,      // explicit order hold
        'legal' => true,      // legal-hold permission
    ],

    // Emit failure alerts when a deletion batch partially fails.
    'deletion_failure_alerts' => (bool) env('MEDIA_DELETION_FAILURE_ALERTS', true),
];
