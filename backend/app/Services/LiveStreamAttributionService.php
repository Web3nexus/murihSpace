<?php

namespace App\Services;

use App\Models\DeviceSession;
use App\Models\LiveStream;
use App\Models\LiveStreamAttribution;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class LiveStreamAttributionService
{
    public function record(Request $request, LiveStream $stream, string $event = 'click'): LiveStreamAttribution
    {
        $user = $request->user('sanctum') ?? $request->user();
        $now = now();
        $sessionId = $this->resolveSessionId($request, $stream);
        $attribution = LiveStreamAttribution::firstOrNew([
            'live_stream_id' => $stream->id,
            'session_id' => $sessionId,
        ]);

        $attribution->fill([
            'user_id' => $attribution->user_id ?? $user?->id,
            'device_session_id' => $this->resolveDeviceSessionId($request, $user?->id) ?? $attribution->device_session_id,
            'source' => $attribution->source ?? $this->resolveSource($request),
            'first_seen_at' => $attribution->first_seen_at ?? $now,
            'last_seen_at' => $now,
            'referrer' => $this->requestValue($request, 'referrer') ?? $request->header('Referer') ?? $attribution->referrer,
            'utm_source' => $this->requestValue($request, 'utm_source') ?? $attribution->utm_source,
            'utm_medium' => $this->requestValue($request, 'utm_medium') ?? $attribution->utm_medium,
            'utm_campaign' => $this->requestValue($request, 'utm_campaign') ?? $attribution->utm_campaign,
            'utm_content' => $this->requestValue($request, 'utm_content') ?? $attribution->utm_content,
            'utm_term' => $this->requestValue($request, 'utm_term') ?? $attribution->utm_term,
            'ip_address' => $request->ip() ?? $attribution->ip_address,
            'user_agent' => $request->userAgent() ?? $attribution->user_agent,
        ]);

        $countField = match ($event) {
            'join' => 'join_count',
            'leave' => 'leave_count',
            'click' => 'click_count',
            'heartbeat' => null,
            default => 'click_count',
        };

        $shouldCount = match ($event) {
            'join' => (int) $attribution->join_count === 0 || $attribution->left_at !== null,
            'leave' => (int) $attribution->join_count > 0 && $attribution->left_at === null,
            'click' => (int) $attribution->click_count === 0,
            default => false,
        };

        if ($countField !== null && $shouldCount) {
            $attribution->{$countField} = ((int) $attribution->{$countField}) + 1;
        }

        if ($event === 'join' && $shouldCount) {
            $attribution->joined_at = $now;
            $attribution->left_at = null;
        }

        if ($event === 'leave' && $shouldCount) {
            $attribution->left_at = $now;
        }

        $attribution->save();

        return $attribution;
    }

    public function resolveSessionId(Request $request, LiveStream $stream): string
    {
        $header = trim((string) $request->header('X-Live-Session-ID'));
        if ($header !== '' && preg_match('/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/D', $header)) {
            return $header;
        }

        return hash('sha256', implode('|', [
            $stream->tracking_id,
            $request->ip() ?? 'unknown',
            $request->userAgent() ?? 'unknown',
            $request->header('X-Device-ID') ?? ($request->user('sanctum') ?? $request->user())?->id ?? 'anonymous',
        ]));
    }

    public function canonicalUrl(LiveStream $stream): string
    {
        $base = rtrim((string) config('app.live_public_url', config('app.frontend_url', config('app.url'))), '/');

        return $base.'/live/'.rawurlencode((string) $stream->tracking_id);
    }

    private function resolveSource(Request $request): string
    {
        $source = strtolower(trim((string) $request->header('X-Client-Platform')));
        if (in_array($source, ['app', 'web'], true)) {
            return $source;
        }

        return 'web';
    }

    private function resolveDeviceSessionId(Request $request, ?int $userId): ?int
    {
        if ($userId === null) {
            return null;
        }

        try {
            $accessToken = $request->user('sanctum')?->currentAccessToken() ?? $request->user()?->currentAccessToken();
            if ($accessToken && isset($accessToken->id)) {
                $deviceSession = DeviceSession::where('user_id', $userId)
                    ->where('personal_access_token_id', $accessToken->id)
                    ->whereNull('revoked_at')
                    ->latest('last_active_at')
                    ->first();

                if ($deviceSession) {
                    return $deviceSession->id;
                }
            }
        } catch (\Throwable) {
        }

        $deviceId = trim((string) $request->header('X-Device-ID'));
        if ($deviceId === '') {
            return null;
        }

        return DeviceSession::where('user_id', $userId)
            ->where('device_id', $deviceId)
            ->whereNull('revoked_at')
            ->latest('last_active_at')
            ->value('id');
    }

    private function requestValue(Request $request, string $key): ?string
    {
        $value = $request->query($key);
        if (! is_string($value)) {
            return null;
        }

        $value = trim($value);

        return $value === '' ? null : Str::limit($value, 100, '');
    }
}
