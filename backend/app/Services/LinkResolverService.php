<?php

namespace App\Services;

use App\Models\Event;
use App\Models\LiveStream;
use App\Models\Meeting;
use Illuminate\Support\Str;

/**
 * Recognises MurihSpace links and reports what they point at.
 *
 * A link shared inside the product (chat bubble, post, native share sheet) must
 * render as an actionable card — "Join Meeting", "Join Live", "View Event" —
 * rather than as bare text, so both the web and the Flutter clients agree on
 * the destination without duplicating routing rules.
 *
 * Detection is purely structural (path shape), and enrichment is best-effort:
 * an unrecognised or stale link resolves to `null` rather than erroring, so a
 * shared preview can never break the surrounding message.
 */
class LinkResolverService
{
    public const TYPE_MEETING = 'meeting';

    public const TYPE_LIVE = 'live';

    public const TYPE_EVENT = 'event';

    public const TYPE_AUDIO_ROOM = 'audio_room';

    /**
     * @return array<string, mixed>|null
     */
    public function resolve(string $input): ?array
    {
        $url = $this->normalise($input);

        if ($url === null) {
            return null;
        }

        return match (true) {
            $this->looksLikeMeeting($url['path']) => $this->meeting($url),
            $this->looksLikeLive($url['path']) => $this->live($url),
            $this->looksLikeAudioRoom($url['path']) => $this->audioRoom($url),
            $this->looksLikeEvent($url['path']) => $this->event($url),
            default => null,
        };
    }

    /**
     * Normalise a pasted string into host + path, or null when it is not a URL.
     *
     * @return array{host: string, path: string}|null
     */
    private function normalise(string $input): ?array
    {
        $raw = trim($input);

        if ($raw === '') {
            return null;
        }

        // Custom scheme used by the mobile app (murihspace://live/xyz).
        if (Str::startsWith(strtolower($raw), ['murihspace://', 'murihspace:'])) {
            $raw = Str::contains($raw, '://')
                ? Str::after($raw, '://')
                : Str::after($raw, 'murihspace:');

            // Keep the path shape intact so it matches the http(s) variants.
            $raw = '/'.ltrim($raw, '/');
        }

        if (! Str::startsWith(strtolower($raw), ['http://', 'https://'])) {
            // Bare host or a path-only deep link.
            if (Str::startsWith($raw, '/')) {
                return ['host' => '', 'path' => $raw];
            }

            if (! Str::contains($raw, '.')) {
                return null;
            }

            $raw = 'https://'.$raw;
        }

        $parsed = parse_url($raw);

        if ($parsed === false || ! isset($parsed['path'])) {
            return null;
        }

        $path = '/'.ltrim($parsed['path'], '/');
        $path = rtrim($path, '/');

        return [
            'host' => strtolower($parsed['host'] ?? ''),
            'path' => $path === '/' ? '/' : $path,
        ];
    }

    private function looksLikeMeeting(string $path): bool
    {
        // /app/meeting/{code}, /meeting/{code}, /meetings/{code}
        return (bool) preg_match('#^/(app/)?meetings?/([a-z0-9]{3}-[a-z0-9]{4}-[a-z0-9]{3})$#i', $path);
    }

    private function looksLikeLive(string $path): bool
    {
        // /live/{trackingId}, /live/resolve/{trackingId}, /app/live
        return (bool) preg_match('#^/(app/)?live(/resolve)?/[A-Za-z0-9:_-]+$#', $path);
    }

    private function looksLikeAudioRoom(string $path): bool
    {
        return (bool) preg_match('#^/(app/)?audio-rooms?/([a-z0-9]+)$#i', $path);
    }

    private function looksLikeEvent(string $path): bool
    {
        return (bool) preg_match('#^/(app/)?(my-)?events?/([a-z0-9-]+)$#i', $path);
    }

    private function code(string $path): string
    {
        $segments = array_values(array_filter(explode('/', $path), fn ($segment) => $segment !== ''));

        return (string) end($segments);
    }

    /**
     * @param  array{host: string, path: string}  $url
     * @return array<string, mixed>
     */
    private function meeting(array $url): array
    {
        $code = strtolower($this->code($url['path']));
        $meeting = Meeting::query()->active()->where('code', $code)->first();

        $payload = [
            'type' => self::TYPE_MEETING,
            'label' => 'Join Meeting',
            'url' => '/app/meeting/'.$code,
            'code' => $code,
            'title' => $meeting?->title ?? 'MurihSpace Meeting',
            'is_active' => $meeting !== null,
            'expires_at' => $meeting?->expires_at?->toIso8601String(),
            'host' => $meeting?->host ? [
                'id' => $meeting->host->id,
                'name' => $meeting->host->name,
                'username' => $meeting->host->username,
                'avatar_url' => $meeting->host->avatar_url ?? $meeting->host->avatar,
            ] : null,
        ];

        if (! $meeting) {
            $payload['title'] = 'Meeting has ended';
            $payload['label'] = 'Meeting Unavailable';
        }

        return $payload;
    }

    /**
     * @param  array{host: string, path: string}  $url
     * @return array<string, mixed>
     */
    private function live(array $url): array
    {
        $token = $this->code($url['path']);
        $stream = $this->findStream($token);

        if (! $stream) {
            return [
                'type' => self::TYPE_LIVE,
                'label' => 'Live Unavailable',
                'url' => '/live/'.rawurlencode($token),
                'tracking_id' => $token,
                'title' => 'This live broadcast is no longer available',
                'is_active' => false,
            ];
        }

        return [
            'type' => self::TYPE_LIVE,
            'label' => 'Join Live',
            'url' => '/live/'.rawurlencode((string) $stream->tracking_id),
            'stream_id' => (int) $stream->id,
            'tracking_id' => (string) $stream->tracking_id,
            'title' => (string) $stream->title,
            'description' => $stream->description,
            'cover_url' => $stream->community?->cover_url ?? null,
            'is_active' => $stream->status === 'live',
            'stream_mode' => $stream->stream_mode,
            'viewers_count' => (int) $stream->viewers_count,
            'host' => $stream->host ? [
                'id' => $stream->host->id,
                'name' => $stream->host->name,
                'username' => $stream->host->username,
                'avatar_url' => $stream->host->avatar_url ?? $stream->host->avatar,
            ] : null,
            'community' => $stream->community ? [
                'id' => $stream->community->id,
                'name' => $stream->community->name,
                'slug' => $stream->community->slug,
            ] : null,
        ];
    }

    /**
     * @param  array{host: string, path: string}  $url
     * @return array<string, mixed>
     */
    private function audioRoom(array $url): array
    {
        return [
            'type' => self::TYPE_AUDIO_ROOM,
            'label' => 'Join Audio Room',
            'url' => '/app/audio-rooms',
            'room_id' => ctype_digit($this->code($url['path'])) ? (int) $this->code($url['path']) : null,
            'title' => 'MurihSpace Audio Room',
            'is_active' => true,
        ];
    }

    /**
     * @param  array{host: string, path: string}  $url
     * @return array<string, mixed>
     */
    private function event(array $url): array
    {
        $slug = $this->code($url['path']);

        $event = Event::query()
            ->where('slug', $slug)
            ->when(ctype_digit($slug), fn ($query) => $query->orWhere('id', (int) $slug))
            ->first();

        if (! $event) {
            return [
                'type' => self::TYPE_EVENT,
                'label' => 'View Event',
                'url' => '/app/events',
                'title' => 'MurihSpace Event',
                'is_active' => false,
            ];
        }

        return [
            'type' => self::TYPE_EVENT,
            'label' => 'View Event',
            'url' => '/app/events/'.$event->slug,
            'event_id' => (int) $event->id,
            'slug' => $event->slug,
            'title' => $event->title,
            'description' => $event->description,
            'cover_url' => $event->cover_url,
            'status' => $event->status,
            'start_date' => $event->start_date?->toIso8601String(),
            'end_date' => $event->end_date?->toIso8601String(),
            'is_active' => $event->status !== 'cancelled',
        ];
    }

    /**
     * Accepts tracking ids, numeric ids and the legacy `id:user` token format
     * the same way `/live/resolve/{token}` does.
     */
    private function findStream(string $token): ?LiveStream
    {
        if ($stream = LiveStream::where('tracking_id', $token)->first()) {
            return $stream;
        }

        if (ctype_digit($token) && $stream = LiveStream::find((int) $token)) {
            return $stream;
        }

        $decoded = base64_decode(strtr($token, '-_', '+/'), true);

        if ($decoded === false || ! preg_match('/^(\d+)(?::(\d+))?$/', trim($decoded), $matches)) {
            return null;
        }

        return LiveStream::find((int) $matches[1]);
    }
}
