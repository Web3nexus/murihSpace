<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    // MurihSpace's ticket/support service (web/marketing-backend). The main
    // application proxies customer-facing ticket endpoints to this service and
    // authenticates machine-to-machine calls with a shared secret.
    'ticket_service' => [
        'base_url' => rtrim((string) env('TICKET_SERVICE_BASE_URL', 'http://127.0.0.1:8123'), '/'),
        'internal_token' => env('TICKET_SERVICE_INTERNAL_TOKEN', env('INTERNAL_API_SECRET', '')),
    ],

    /*
    |--------------------------------------------------------------------------
    | Support event synchronization (web/marketing-backend)
    |--------------------------------------------------------------------------
    |
    | The platform pushes domain events (user.created, kyc.rejected,
    | order.failed, payment.failed, ...) to the support system's webhook. The
    | support system persists them idempotently and may auto-raise tickets.
    | This is intentionally event/webhook based so the two applications stay
    | decoupled; delivery is queued on our side.
    |
    */

    'support_events' => [
        'base_url' => rtrim((string) (env('SUPPORT_EVENTS_BASE_URL') ?: env('TICKET_SERVICE_BASE_URL', 'http://127.0.0.1:8123')), '/'),
        'token' => env('SUPPORT_EVENTS_INTERNAL_TOKEN') ?: env('TICKET_SERVICE_INTERNAL_TOKEN', env('INTERNAL_API_SECRET', '')),
        'endpoint' => '/api/internal/events',
        'enabled' => filter_var(env('SUPPORT_EVENTS_ENABLED', true), FILTER_VALIDATE_BOOLEAN),
    ],

    'anthropic' => [
        'key' => env('ANTHROPIC_API_KEY'),
        'model' => env('ANTHROPIC_MODEL', 'claude-sonnet-4-6'),
        'max_tokens' => (int) env('ANTHROPIC_MAX_TOKENS', 1024),

        // Platform-wide AI behavior defaults. Per-creator overrides live in the
        // ai_settings table and are merged on top of these at request time.
        'behavior' => [
            'persona' => env('ANTHROPIC_PERSONA', 'Mera'),
            'tone' => env('ANTHROPIC_TONE', 'Warm, friendly and practical. Encouraging without being generic.'),
            // Explicit topic scope for the whole platform, e.g. 'creator business,
            // content strategy, community building'. Empty => derive scope from
            // each creator's own onboarding profile.
            'focus_topics' => env('ANTHROPIC_FOCUS_TOPICS'),
            // Redirect off-topic questions back to the creator's niche/business.
            'keep_on_topic' => filter_var(env('ANTHROPIC_KEEP_ON_TOPIC', true), FILTER_VALIDATE_BOOLEAN),
            // redirect | decline | flexible
            'off_topic_mode' => env('ANTHROPIC_OFF_TOPIC_MODE', 'redirect'),
        ],
    ],

    'openai' => [
        'key' => env('OPENAI_API_KEY'),
        'model' => env('OPENAI_MODEL', 'gpt-4o-mini'),
        'endpoint' => env('OPENAI_ENDPOINT', 'https://api.openai.com/v1/chat/completions'),
    ],

    'gemini' => [
        'key' => env('GEMINI_API_KEY'),
        'model' => env('GEMINI_MODEL', 'gemini-2.5-flash'),
        'endpoint' => env('GEMINI_ENDPOINT', 'https://generativelanguage.googleapis.com/v1beta/models'),
    ],

    'ai' => [
        // Which provider the platform uses by default: anthropic | openai | gemini.
        // The admin can change this at runtime from /securegate/ai-settings.
        'default_provider' => env('AI_PROVIDER', 'anthropic'),
        'max_tokens' => (int) env('AI_MAX_TOKENS', 1024),
        'providers' => ['anthropic', 'openai', 'gemini'],
    ],

    'google' => [
        'client_id' => env('GOOGLE_CLIENT_ID'),
        'client_secret' => env('GOOGLE_CLIENT_SECRET'),
        'redirect' => env('GOOGLE_REDIRECT_URI'),
    ],

    // Facebook login has been permanently removed from the platform. The
    // account data of users who previously signed in with Facebook is
    // preserved; only the provider link is cleared (see the
    // migrate_facebook_accounts migration). No Facebook OAuth config exists.

    'apple' => [
        'client_id' => env('APPLE_CLIENT_ID'),
        'client_secret' => env('APPLE_CLIENT_SECRET'),
        'redirect' => env('APPLE_REDIRECT_URI'),
        'team_id' => env('APPLE_TEAM_ID'),
        'key_id' => env('APPLE_KEY_ID'),
        'private_key' => env('APPLE_PRIVATE_KEY'),
    ],

    /*
    |--------------------------------------------------------------------------
    | Phone OTP (Twilio Verify)
    |--------------------------------------------------------------------------
    |
    | Phone verification is MurihSpace's default authentication method. Codes
    | are never generated or stored locally for the Twilio driver: Twilio Verify
    | starts the verification and checks the code on our behalf.
    |
    | OTP_DRIVER selects the driver:
    |   - twilio  real Twilio Verify (production)
    |   - log     local dev/test driver that writes the code to the log and a
    |             temporary cache key (never used in production)
    |
    | All values below are runtime-only secrets; they are never exposed to the
    | frontend.
    */
    'twilio' => [
        'account_sid' => env('TWILIO_ACCOUNT_SID'),
        'auth_token' => env('TWILIO_AUTH_TOKEN'),
        'verify_service_sid' => env('TWILIO_VERIFY_SERVICE_SID'),
        'default_country' => env('TWILIO_DEFAULT_COUNTRY', 'NG'),
        'channel' => env('TWILIO_OTP_CHANNEL', 'sms'),
        'otp_driver' => env('OTP_DRIVER', env('APP_ENV') === 'production' ? 'twilio' : 'log'),
        'code_ttl' => (int) env('OTP_CODE_TTL', 10),
        'resend_cooldown' => (int) env('OTP_RESEND_COOLDOWN', 60),
        'max_per_number_per_hour' => (int) env('OTP_MAX_PER_NUMBER_PER_HOUR', 5),
        'max_per_ip_per_hour' => (int) env('OTP_MAX_PER_IP_PER_HOUR', 10),
        'max_per_device_per_hour' => (int) env('OTP_MAX_PER_DEVICE_PER_HOUR', 10),
        'max_daily_per_number' => (int) env('OTP_MAX_DAILY_PER_NUMBER', 10),
        'max_verify_attempts' => (int) env('OTP_MAX_VERIFY_ATTEMPTS', 5),
        'blocked_countries' => array_values(array_filter(array_map('trim', explode(',', (string) env('OTP_BLOCKED_COUNTRIES', ''))))),
    ],

    'sms' => [
        'driver' => env('SMS_DRIVER', 'log'),
        'account_sid' => env('TWILIO_ACCOUNT_SID'),
        'auth_token' => env('TWILIO_AUTH_TOKEN'),
        'from_number' => env('TWILIO_SMS_FROM'),
    ],
];
