<?php

namespace App\Services;

use Illuminate\Support\Str;

class SocialProfileService
{
    /**
     * Platform slug → canonical profile URL template. {handle} is substituted.
     */
    private const URL_TEMPLATES = [
        'instagram' => 'https://www.instagram.com/{handle}',
        'twitter' => 'https://x.com/{handle}',
        'tiktok' => 'https://www.tiktok.com/@{handle}',
        'youtube' => 'https://www.youtube.com/@{handle}',
        'facebook' => 'https://www.facebook.com/{handle}',
        'snapchat' => 'https://www.snapchat.com/add/{handle}',
        'linkedin' => 'https://www.linkedin.com/in/{handle}',
        'github' => 'https://github.com/{handle}',
        'pinterest' => 'https://www.pinterest.com/{handle}',
        'twitch' => 'https://www.twitch.tv/{handle}',
        'discord' => 'https://discord.gg/{handle}',
        'website' => null,
    ];

    public function platforms(): array
    {
        return array_keys(self::URL_TEMPLATES);
    }

    /**
     * Normalize a social handle for a platform. Returns null when invalid.
     */
    public function normalizeHandle(string $platform, string $handle): ?string
    {
        $handle = trim(trim($handle), '@');
        $handle = preg_replace('#^https?://[^\s]+#i', '', $handle);
        $handle = trim($handle, " \t\n\r\0\x0B/@");
        $handle = preg_replace('/[^a-zA-Z0-9_.\-]/', '', $handle);

        if ($handle === '') {
            return null;
        }

        return Str::limit($handle, 100);
    }

    /**
     * Build a canonical profile URL for a platform + handle.
     * Returns null when the platform has no URL template (e.g. website).
     */
    public function url(string $platform, string $handle): ?string
    {
        $template = self::URL_TEMPLATES[$platform] ?? null;

        if ($template === null) {
            return null;
        }

        return str_replace('{handle}', $handle, $template);
    }

    /**
     * Validate a full profile URL against the platform's canonical template.
     */
    public function validateUrl(string $platform, string $url): bool
    {
        $template = self::URL_TEMPLATES[$platform] ?? null;

        if ($template === null) {
            return filter_var($url, FILTER_VALIDATE_URL) !== false;
        }

        $pattern = preg_quote($template, '#');
        $pattern = str_replace(preg_quote('{handle}', '#'), '[a-zA-Z0-9_.\-]{1,100}', $pattern);

        return (bool) preg_match("#^{$pattern}$#i", trim($url));
    }
}
