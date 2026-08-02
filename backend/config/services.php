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

    'facebook' => [
        'client_id' => env('FACEBOOK_CLIENT_ID'),
        'client_secret' => env('FACEBOOK_CLIENT_SECRET'),
        'redirect' => env('FACEBOOK_REDIRECT_URI'),
    ],

    'apple' => [
        'client_id' => env('APPLE_CLIENT_ID'),
        'client_secret' => env('APPLE_CLIENT_SECRET'),
        'redirect' => env('APPLE_REDIRECT_URI'),
        'team_id' => env('APPLE_TEAM_ID'),
        'key_id' => env('APPLE_KEY_ID'),
        'private_key' => env('APPLE_PRIVATE_KEY'),
    ],

];
