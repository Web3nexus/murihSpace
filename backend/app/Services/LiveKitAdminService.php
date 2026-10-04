<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Throwable;

/**
 * Server-side administration of LiveKit rooms over the LiveKit Twirp API.
 *
 * A client token can only grant permissions inside the browser tab that holds
 * it, which is not enough for host moderation: muting or kicking a remote
 * participant must be authoritative, because the target device never receives
 * a fresh token and could simply ignore a local request. LiveKit's room service
 * is the source of truth — it reports the real roster and mutates participants
 * server-side, notifying connected clients through room events.
 *
 * Every call is best-effort: when the deployment is unreachable the helpers
 * return a neutral result instead of throwing, so a media outage can never turn
 * a moderation click into a 500 for the host.
 */
class LiveKitAdminService
{
    /**
     * Time in seconds after which presence rows are considered stale.
     */
    public const PRESENCE_TTL_SECONDS = 90;

    public function isConfigured(): bool
    {
        return $this->apiKey() !== '' && $this->apiSecret() !== '';
    }

    /**
     * LiveKit room roster as reported by the media server.
     *
     * @return array<int, array<string, mixed>>
     */
    public function listParticipants(string $roomName): array
    {
        $result = $this->twirp('RoomService/ListParticipants', ['room' => $roomName]);

        return is_array($result['participants'] ?? null) ? array_values($result['participants']) : [];
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function listRooms(): array
    {
        $result = $this->twirp('RoomService/ListRooms', []);

        $rooms = $result['rooms'] ?? $result;

        return is_array($rooms) ? array_values($rooms) : [];
    }

    /**
     * Force a participant's published microphone off.
     *
     * `MutePublishedTrack` targets a concrete track SID, so the participant is
     * resolved first and their live microphone track located; there is nothing
     * to mute if they have not published one yet.
     */
    public function muteParticipant(string $roomName, string $identity, string $source = 'MICROPHONE'): bool
    {
        $trackSid = $this->publishedTrackSid($roomName, $identity, $source);

        if ($trackSid === null) {
            return false;
        }

        $response = $this->twirp('RoomService/MutePublishedTrack', [
            'room' => $roomName,
            'identity' => $identity,
            'trackSid' => $trackSid,
        ]);

        return $this->succeeded($response);
    }

    /**
     * Revoke a participant's ability to publish (used for "restrict").
     *
     * LiveKit applies permissions atomically, so every field we care about has
     * to be present: an omitted `canSubscribe` would also blind the viewer.
     */
    public function restrictParticipant(string $roomName, string $identity): bool
    {
        return $this->setPermissions($roomName, $identity, [
            'canPublish' => false,
            'canSubscribe' => true,
            'canPublishData' => true,
            'canUpdateMetadata' => false,
        ]);
    }

    /**
     * Restore publish rights after a `restrictParticipant` call.
     */
    public function unrestrictParticipant(string $roomName, string $identity): bool
    {
        return $this->setPermissions($roomName, $identity, [
            'canPublish' => true,
            'canSubscribe' => true,
            'canPublishData' => true,
            'canUpdateMetadata' => true,
        ]);
    }

    /**
     * @param  array<string, bool>  $permissions
     */
    private function setPermissions(string $roomName, string $identity, array $permissions): bool
    {
        $response = $this->twirp('RoomService/UpdateParticipant', [
            'room' => $roomName,
            'identity' => $identity,
            'permission' => $permissions,
        ]);

        return $this->succeeded($response);
    }

    /**
     * Disconnect a participant from the room.
     */
    public function removeParticipant(string $roomName, string $identity): bool
    {
        $response = $this->twirp('RoomService/RemoveParticipant', [
            'room' => $roomName,
            'identity' => $identity,
        ]);

        return $this->succeeded($response);
    }

    /**
     * Disconnect everyone currently in the room (used when a host ends a session).
     */
    public function removeAllParticipants(string $roomName, ?string $exceptIdentity = null): int
    {
        $removed = 0;

        foreach ($this->identitiesInRoom($roomName) as $identity) {
            if ($exceptIdentity !== null && $identity === $exceptIdentity) {
                continue;
            }

            if ($this->removeParticipant($roomName, $identity)) {
                $removed++;
            }
        }

        return $removed;
    }

    /**
     * Update the participant metadata clients read for role/name display.
     */
    public function updateParticipantMetadata(string $roomName, string $identity, string $metadata): bool
    {
        $response = $this->twirp('RoomService/UpdateParticipant', [
            'room' => $roomName,
            'identity' => $identity,
            'metadata' => $metadata,
        ]);

        return $this->succeeded($response);
    }

    /**
     * Send a reliable data packet to a single participant (moderation notices).
     *
     * `data` is a protobuf `bytes` field, so it travels base64-encoded.
     *
     * @param  array<string, mixed>  $payload
     */
    public function sendData(string $roomName, string $identity, array $payload): bool
    {
        $response = $this->twirp('RoomService/SendData', [
            'room' => $roomName,
            'data' => base64_encode((string) json_encode($payload)),
            'destinationIdentities' => [$identity],
            'reliable' => true,
        ]);

        return $this->succeeded($response);
    }

    /**
     * Read the server-reported list of identities currently in a room.
     *
     * @return array<int, string>
     */
    public function identitiesInRoom(string $roomName): array
    {
        return array_values(array_filter(array_map(
            fn (array $participant) => is_string($participant['identity'] ?? null) ? $participant['identity'] : null,
            $this->listParticipants($roomName)
        )));
    }

    /**
     * Locate the SID of a participant's live (unmuted, still published) track.
     */
    public function publishedTrackSid(string $roomName, string $identity, string $source): ?string
    {
        foreach ($this->listParticipants($roomName) as $participant) {
            if (($participant['identity'] ?? null) !== $identity) {
                continue;
            }

            foreach (($participant['tracks'] ?? []) as $track) {
                if (! is_array($track)) {
                    continue;
                }

                if (strtoupper((string) ($track['source'] ?? '')) !== strtoupper($source)) {
                    continue;
                }

                $sid = $track['sid'] ?? null;

                if (is_string($sid) && $sid !== '') {
                    return $sid;
                }
            }
        }

        return null;
    }

    /**
     * Twirp POST with a short-lived admin JWT.
     *
     * @param  array<string, mixed>  $payload
     * @return array<string, mixed>
     */
    private function twirp(string $service, array $payload): array
    {
        if (! $this->isConfigured()) {
            Log::warning('[LiveKitAdmin] Twirp skipped: LiveKit credentials are not configured.', ['service' => $service]);

            return ['_error' => 'not_configured'];
        }

        try {
            $response = Http::withToken($this->adminToken())
                ->timeout(8)
                ->acceptJson()
                ->asJson()
                ->post($this->endpoint($service), $payload);

            if (! $response->successful()) {
                Log::warning('[LiveKitAdmin] Twirp call failed.', [
                    'service' => $service,
                    'status' => $response->status(),
                    'body' => Str::limit((string) $response->body(), 300),
                ]);

                return ['_error' => 'http_'.$response->status()];
            }

            $decoded = $response->json();

            return is_array($decoded) ? $decoded : [];
        } catch (Throwable $e) {
            Log::warning('[LiveKitAdmin] Twirp call threw: '.$e->getMessage(), ['service' => $service]);

            return ['_error' => $e->getMessage()];
        }
    }

    /**
     * @param  array<string, mixed>  $response
     */
    private function succeeded(array $response): bool
    {
        return ! ($response['_error'] ?? false);
    }

    private function endpoint(string $service): string
    {
        return $this->host().'/twirp/livekit.'.$service;
    }

    /**
     * LiveKit accepts a normal access token carrying `roomAdmin` for its server
     * API, so no extra dependency is required.
     */
    private function adminToken(): string
    {
        return app(LiveKitService::class)->generateAdminToken();
    }

    private function host(): string
    {
        return rtrim((string) (config('livekit.host') ?: 'http://localhost:7880'), '/');
    }

    private function apiKey(): string
    {
        return (string) (config('livekit.api_key') ?: '');
    }

    private function apiSecret(): string
    {
        return (string) (config('livekit.api_secret') ?: '');
    }
}