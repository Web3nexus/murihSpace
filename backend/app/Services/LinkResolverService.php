<?php

namespace App\Services;

use App\Models\Community;
use App\Models\Conversation;
use App\Models\DigitalProduct;
use App\Models\Event;
use App\Models\LiveStream;
use App\Models\Meeting;
use App\Models\PhysicalProduct;
use App\Models\Storefront;
use App\Models\User;
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

    public const TYPE_PRODUCT = 'product';

    public const TYPE_PROFILE = 'profile';

    public const TYPE_COMMUNITY = 'community';

    public const TYPE_STOREFRONT = 'storefront';

    public const TYPE_CHAT = 'chat';

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
            $this->looksLikeProduct($url['path']) => $this->product($url),
            $this->looksLikeCommunity($url['path']) => $this->community($url),
            $this->looksLikeStorefront($url['path']) => $this->storefront($url),
            $this->looksLikeProfile($url['path']) => $this->profile($url),
            $this->looksLikeChat($url['path']) => $this->chat($url),
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

        $host = strtolower($parsed['host'] ?? '');

        // Only MurihSpace hosts are ours. Without this check any pasted URL that
        // happens to share a path shape — `https://evil.example/live/abc` —
        // would be rendered as a legitimate MurihSpace preview card.
        if ($host !== '' && ! $this->isMurihSpaceHost($host)) {
            return null;
        }

        return [
            'host' => $host,
            'path' => $path === '/' ? '/' : $path,
        ];
    }

    /**
     * Whether a host belongs to MurihSpace, including every subdomain.
     *
     * Matching on the registrable domain rather than an allow-list keeps new
     * hosts (web, staging, live, …) working without another code change, while
     * still rejecting `notmurihspace.com` and any other domain.
     */
    private function isMurihSpaceHost(string $host): bool
    {
        return $host === 'murihspace.com'
            || str_ends_with($host, '.murihspace.com');
    }

    private function looksLikeMeeting(string $path): bool
    {
        // Canonical /m/{code}, plus /app/meeting/{code}, /meeting/{code} and
        // /meetings/{code}. A bare /meetings is the hub, not a room, and
        // `instant` is the reserved "start now" route.
        //
        // The code shape is deliberately permissive — one URL-safe segment —
        // because no single format is enforced at creation time, and a stricter
        // pattern would reject real invites and dead-end the shared link.
        return (bool) preg_match(
            '#^/(?:app/)?(?:m|meetings?)/([A-Za-z0-9_-]{3,64})$#',
            $path,
            $matches
        ) && strtolower($matches[1]) !== 'instant';
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
        // Canonical /e/{id}, plus /events/{slug}, /my-events and /app/events.
        return (bool) preg_match('#^/e/([a-z0-9-]+)$#i', $path)
            || (bool) preg_match('#^/(app/)?(my-)?events?/([a-z0-9-]+)$#i', $path);
    }

    /**
     * Canonical /p/{id}, plus /products/{id} and /store/{code}/p/{id}.
     */
    private function looksLikeProduct(string $path): bool
    {
        if ((bool) preg_match('#^/(p|products?)/([a-z0-9_-]+)$#i', $path)) {
            return true;
        }

        return (bool) preg_match('#^/store/([a-z0-9_-]+)/p/([a-z0-9_-]+)$#i', $path);
    }

    /**
     * Canonical /c/{slug}, plus /communities/{slug} and /app/community/{slug}.
     */
    private function looksLikeCommunity(string $path): bool
    {
        return (bool) preg_match('#^/c/([a-z0-9_-]+)$#i', $path)
            || (bool) preg_match('#^/(app/)?communities?/([a-z0-9_-]+)$#i', $path);
    }

    /**
     * Canonical /store/{shortCode} only. The product shape under the same
     * prefix is claimed first by looksLikeProduct().
     */
    private function looksLikeStorefront(string $path): bool
    {
        return (bool) preg_match('#^/store/([a-z0-9_-]+)$#i', $path);
    }

    /**
     * Canonical /u/{username}, plus /l/{username} (link in bio) and the
     * @handle form. Matched last so a named route is never mistaken for a
     * handle.
     */
    private function looksLikeProfile(string $path): bool
    {
        return (bool) preg_match('#^/(u|l|bio)/@?([a-z0-9_.-]+)$#i', $path);
    }

    /**
     * Canonical /chat/{id}, plus /conversation/{id} and
     * /app/conversation/{id}.
     */
    private function looksLikeChat(string $path): bool
    {
        if (! preg_match('#^/(app/)?(chat|conversation)/(\d+)$#i', $path, $matches)) {
            return false;
        }

        // A conversation is private, so only confirm it for a participant.
        // Non-participants fall through to the profile matcher and get plain
        // text rather than a card promising access they do not have.
        if (! auth()->check()) {
            return false;
        }

        return Conversation::query()
            ->where('id', (int) $matches[3])
            ->whereHas('participants', fn ($query) => $query->where('user_id', auth()->id()))
            ->exists();
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
            'url' => '/m/'.$code,
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

        $isLive = $stream->status === 'live';

        return [
            'type' => self::TYPE_LIVE,
            'label' => $isLive ? 'Join Live' : 'Broadcast Ended',
            'url' => '/live/'.rawurlencode((string) $stream->tracking_id),
            'stream_id' => (int) $stream->id,
            'tracking_id' => (string) $stream->tracking_id,
            'title' => $isLive ? (string) $stream->title : (string) $stream->title.' (Ended)',
            'description' => $stream->description,
            'cover_url' => $stream->community?->cover_url ?? null,
            'is_active' => $isLive,
            'status' => $stream->status,
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
            // The canonical share path carries the numeric id, because the
            // events API is typed `show(int $id)` and cannot resolve a slug.
            // A slug here would produce a link that 404s in the app.
            'url' => '/e/'.$event->id,
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
     * @param  array{host: string, path: string}  $url
     * @return array<string, mixed>
     */
    private function product(array $url): array
    {
        $identifier = ltrim($this->code($url['path']), '/');
        // /store/{code}/p/{id} carries the product id in the final segment.
        if (preg_match('#^/store/[^/]+/p/([^/]+)$#i', $url['path'], $matches)) {
            $identifier = $matches[1];
        }

        // Emitted URLs carry the segment the caller gave us, prefix and all.
        // The two tables are independent, so a physical and a digital product
        // can share a numeric id: dropping the hint would make the card link
        // back to a different product than the one it is describing.
        $rawIdentifier = $identifier;

        // The marketplace accepts an explicit `p_`/`d_` prefix, which is what a
        // storefront product card links to so the intended catalogue is
        // unambiguous when a physical and a digital product share a numeric id.
        $hint = null;
        if (preg_match('#^([pd])_(.+)$#i', $identifier, $prefixed)) {
            $hint = strtolower($prefixed[1]);
            $identifier = $prefixed[2];
        }

        $isNumeric = ctype_digit($identifier);
        $physical = ($hint !== 'd' && $isNumeric) ? PhysicalProduct::find((int) $identifier) : null;
        $digital = ($hint !== 'p' && $physical === null && $isNumeric)
            ? DigitalProduct::find((int) $identifier)
            : null;

        $product = $physical ?? $digital;

        // One payload for "nothing to show here", whether the row is gone or
        // the seller has simply taken it down. Describing a delisted product in
        // a preview card would publish its title, price and seller to everyone
        // the link was ever shared with, long after it stopped being listed.
        $unavailable = static function () use ($rawIdentifier): array {
            return [
                'type' => self::TYPE_PRODUCT,
                'label' => 'View Product',
                'url' => '/p/'.$rawIdentifier,
                'title' => 'This product is no longer available',
                'is_active' => false,
            ];
        };

        if ($product === null) {
            return $unavailable();
        }

        $isVisible = $physical !== null
            ? (bool) $physical->is_active
            : (bool) ($digital->is_public ?? false);

        if (! $isVisible) {
            return $unavailable();
        }

        $seller = $product->creator()->first();

        // Physical products carry an `images` array; digital ones a single
        // `cover_url`. Normalise both to one preview image for the card.
        $cover = null;
        if ($physical !== null) {
            $images = $physical->images;
            $cover = is_array($images) ? ($images[0] ?? null) : null;
        } else {
            $cover = $digital?->cover_url;
        }

        return [
            'type' => self::TYPE_PRODUCT,
            'label' => 'View Product',
            'url' => '/p/'.$rawIdentifier,
            'product_id' => (int) $product->id,
            'title' => (string) $product->title,
            'description' => $product->description ?? null,
            'cover_url' => $cover,
            'price' => $product->price ?? null,
            'currency' => $product->currency ?? null,
            'seller' => $seller ? [
                'id' => $seller->id,
                'name' => $seller->name,
                'username' => $seller->username,
                'avatar_url' => $seller->avatar_url ?? $seller->avatar,
            ] : null,
            'is_active' => $isVisible,
        ];
    }

    /**
     * @param  array{host: string, path: string}  $url
     * @return array<string, mixed>
     */
    private function community(array $url): array
    {
        $slug = $this->code($url['path']);
        $community = Community::query()->where('slug', $slug)->first();

        if ($community === null) {
            return [
                'type' => self::TYPE_COMMUNITY,
                'label' => 'View Community',
                'url' => '/c/'.$slug,
                'title' => 'This community is no longer available',
                'is_active' => false,
            ];
        }

        // A private community is not ours to describe. The preview card would
        // otherwise publish its description, cover and member count to everyone
        // the link was ever shared with.
        if ($community->visibility !== null && $community->visibility !== 'public') {
            return [
                'type' => self::TYPE_COMMUNITY,
                'label' => 'View Community',
                'url' => '/c/'.$slug,
                'title' => 'This community is no longer available',
                'is_active' => false,
            ];
        }

        return [
            'type' => self::TYPE_COMMUNITY,
            'label' => 'View Community',
            'url' => '/c/'.$community->slug,
            'community_id' => (int) $community->id,
            'slug' => $community->slug,
            'title' => (string) $community->name,
            'description' => $community->description,
            'cover_url' => $community->cover_url ?? $community->logo_url,
            'members_count' => (int) ($community->members_count ?? 0),
            'is_active' => $community->visibility === 'public' || $community->visibility === null,
        ];
    }

    /**
     * @param  array{host: string, path: string}  $url
     * @return array<string, mixed>
     */
    private function storefront(array $url): array
    {
        $shortCode = $this->code($url['path']);
        $storefront = Storefront::query()->where('short_code', $shortCode)->first();

        if ($storefront === null) {
            return [
                'type' => self::TYPE_STOREFRONT,
                'label' => 'Visit Store',
                'url' => '/store/'.$shortCode,
                'title' => 'This storefront is no longer available',
                'is_active' => false,
            ];
        }

        // A draft store has not agreed to be shown: name, tagline, cover and
        // owner all stay out of the card until it is published.
        if (! (bool) $storefront->is_published) {
            return [
                'type' => self::TYPE_STOREFRONT,
                'label' => 'Visit Store',
                'url' => '/store/'.$shortCode,
                'title' => 'This storefront is no longer available',
                'is_active' => false,
            ];
        }

        return [
            'type' => self::TYPE_STOREFRONT,
            'label' => 'Visit Store',
            'url' => '/store/'.$storefront->short_code,
            'storefront_id' => (int) $storefront->id,
            'title' => (string) ($storefront->display_name ?? $storefront->name),
            'description' => $storefront->tagline,
            'cover_url' => $storefront->cover_url ?? $storefront->avatar_url,
            'owner' => $storefront->user ? [
                'id' => $storefront->user->id,
                'name' => $storefront->user->name,
                'username' => $storefront->user->username,
                'avatar_url' => $storefront->user->avatar_url ?? $storefront->user->avatar,
            ] : null,
            'is_active' => (bool) $storefront->is_published,
        ];
    }

    /**
     * @param  array{host: string, path: string}  $url
     * @return array<string, mixed>
     */
    private function profile(array $url): array
    {
        $handle = ltrim($this->code($url['path']), '@');
        // Username only. /u/5 means the handle "5": matching on id as well would
        // hand back whoever happens to own that row — a different person to the
        // one the link names — and would also turn a miss into an id probe.
        $user = User::query()->where('username', $handle)->first();

        if ($user === null) {
            return [
                'type' => self::TYPE_PROFILE,
                'label' => 'View Profile',
                'url' => '/u/'.$handle,
                'title' => 'Profile unavailable',
                'is_active' => false,
            ];
        }

        return [
            'type' => self::TYPE_PROFILE,
            'label' => 'View Profile',
            'url' => '/u/'.$user->username,
            'user_id' => (int) $user->id,
            'title' => (string) $user->name,
            'username' => $user->username,
            'avatar_url' => $user->avatar_url ?? $user->avatar,
            'role' => $user->role,
            'is_active' => true,
        ];
    }

    /**
     * @param  array{host: string, path: string}  $url
     * @return array<string, mixed>
     */
    private function chat(array $url): array
    {
        $id = $this->code($url['path']);
        $conversation = Conversation::query()->find((int) $id);
        $other = $conversation?->users()
            ->where('users.id', '!=', auth()->id())
            ->first();

        return [
            'type' => self::TYPE_CHAT,
            'label' => 'Open Chat',
            'url' => '/chat/'.$id,
            'conversation_id' => (int) $id,
            'title' => $other?->name ?? 'Conversation',
            'avatar_url' => $other ? ($other->avatar_url ?? $other->avatar) : null,
            'is_active' => $conversation !== null,
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
