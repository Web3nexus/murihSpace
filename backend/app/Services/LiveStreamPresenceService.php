<?php

namespace App\Services;

use App\Events\LiveStreamParticipantPresence;
use App\Exceptions\RemovedFromSessionException;
use App\Models\LiveStream;
use App\Models\LiveStreamParticipant;
use Illuminate\Database\Eloquent\Builder;

/**
 * Presence and moderation state for a live broadcast.
 *
 * Mirrors MeetingPresenceService, but the live roster also drives viewer counts
 * and the host's moderation panel, and it must tolerate anonymous guests who
 * never create a database row.
 */
class LiveStreamPresenceService
{
    public function __construct(private readonly LiveKitAdminService $liveKit) {}

    public function join(LiveStream $stream, int $userId, string $role): LiveStreamParticipant
    {
        $existing = LiveStreamParticipant::query()
            ->where('live_stream_id', $stream->id)
            ->where('user_id', $userId)
            ->first();

        // Removal is sticky for the lifetime of the stream: without this the
        // upsert would reactivate the row and put a viewer the host just kicked
        // back on the air on their next request. The row cascades away with the
        // stream, so this is per-session, not a ban.
        if ($existing && $existing->removed_at !== null) {
            throw new RemovedFromSessionException('live stream', (string) $stream->id);
        }

        $participant = LiveStreamParticipant::updateOrCreate(
            [
                'live_stream_id' => $stream->id,
                'user_id' => $userId,
            ],
            [
                // A host is always the host; never let a stale role overwrite it.
                'role' => $existing?->role === LiveStreamParticipant::ROLE_HOST || $role === LiveStreamParticipant::ROLE_HOST
                    ? LiveStreamParticipant::ROLE_HOST
                    : ($existing?->role ?? $role),
                'is_active' => true,
                'is_restricted' => $existing?->is_restricted ?? false,
                'joined_at' => $existing?->joined_at ?? now(),
                'left_at' => null,
                'last_seen_at' => now(),
            ]
        );

        $this->broadcast($stream, 'joined', $participant);

        return $participant;
    }

    public function leave(LiveStream $stream, int $userId): ?LiveStreamParticipant
    {
        $participant = LiveStreamParticipant::query()
            ->where('live_stream_id', $stream->id)
            ->where('user_id', $userId)
            ->first();

        if (! $participant || ! $participant->is_active) {
            return $participant;
        }

        $participant->update([
            'is_active' => false,
            'left_at' => now(),
            'last_seen_at' => now(),
        ]);

        $this->broadcast($stream, 'left', $participant);

        return $participant;
    }

    public function participantFor(LiveStream $stream, int $userId): ?LiveStreamParticipant
    {
        return LiveStreamParticipant::query()
            ->where('live_stream_id', $stream->id)
            ->where('user_id', $userId)
            ->first();
    }

    /**
     * Server-side authorization for live moderation. The stream owner is always
     * allowed; co-hosts/moderators are allowed through their roster role.
     */
    public function moderatorFor(LiveStream $stream, int $userId, bool $isAdmin = false): ?LiveStreamParticipant
    {
        if ((int) $stream->user_id === $userId || $isAdmin) {
            return $this->participantFor($stream, $userId) ?? LiveStreamParticipant::make([
                'live_stream_id' => $stream->id,
                'user_id' => $userId,
                'role' => LiveStreamParticipant::ROLE_HOST,
                'is_active' => true,
            ]);
        }

        $participant = $this->participantFor($stream, $userId);

        return $participant && $participant->canModerate() ? $participant : null;
    }

    /**
     * Full roster for the host's participant panel.
     *
     * @return array<int, array<string, mixed>>
     */
    public function roster(LiveStream $stream): array
    {
        return $this->query($stream)->get()->map(
            fn (LiveStreamParticipant $participant) => $participant->toPresencePayload()
        )->all();
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function activeRoster(LiveStream $stream): array
    {
        return $this->query($stream)
            ->where('is_active', true)
            ->get()
            ->map(fn (LiveStreamParticipant $participant) => $participant->toPresencePayload())
            ->all();
    }

    public function setRole(LiveStream $stream, LiveStreamParticipant $participant, string $role): LiveStreamParticipant
    {
        $participant->update(['role' => $role, 'last_seen_at' => now()]);

        $this->liveKit->updateParticipantMetadata($stream->livekit_room, $this->identityFor($participant), (string) json_encode([
            'user_id' => (int) $participant->user_id,
            'name' => $participant->user?->name,
            'role' => $role,
        ]));

        // Publish rights are decided when the participant's token is minted, so
        // without this a demoted co-host keeps broadcasting and a promoted
        // viewer cannot broadcast at all until they rejoin. The roster role and
        // the media server must agree immediately, for the same reason
        // setRestricted treats a refusal as a failure.
        if ($this->liveKit->isConfigured()) {
            $shouldPublish = $participant->canModerate() && ! $participant->is_restricted;

            $shouldPublish
                ? $this->liveKit->unrestrictParticipant($stream->livekit_room, $this->identityFor($participant))
                : $this->liveKit->restrictParticipant($stream->livekit_room, $this->identityFor($participant));
        }

        $this->broadcast($stream, 'updated', $participant, ['reason' => 'role_changed', 'role' => $role]);

        return $participant;
    }

    /**
     * Force a viewer's microphone off in the room.
     */
    public function mute(LiveStream $stream, LiveStreamParticipant $participant): bool
    {
        $ok = $this->liveKit->muteParticipant($stream->livekit_room, $this->identityFor($participant));

        $participant->update(['last_seen_at' => now()]);
        $this->broadcast($stream, 'updated', $participant, ['reason' => 'muted']);

        return $ok;
    }

    public function setRestricted(LiveStream $stream, LiveStreamParticipant $participant, bool $restricted): bool
    {
        $ok = $restricted
            ? $this->liveKit->restrictParticipant($stream->livekit_room, $this->identityFor($participant))
            : $this->liveKit->unrestrictParticipant($stream->livekit_room, $this->identityFor($participant));

        // The roster flag mirrors LiveKit publish permissions, so a media-server
        // refusal must not be recorded as if it succeeded — otherwise a host
        // sees "restricted" while the participant keeps streaming. Muting and
        // removal stay best-effort, matching the meeting moderation rules.
        if ($this->liveKit->isConfigured() && ! $ok) {
            return false;
        }

        $participant->update(['is_restricted' => $restricted, 'last_seen_at' => now()]);
        $this->broadcast($stream, 'updated', $participant, [
            'reason' => $restricted ? 'restricted' : 'unrestricted',
        ]);

        return $ok;
    }

    /**
     * Disconnect a viewer/co-host and clear their presence row.
     */
    public function remove(LiveStream $stream, LiveStreamParticipant $participant): bool
    {
        $ok = $this->liveKit->removeParticipant($stream->livekit_room, $this->identityFor($participant));

        // Unlike leave(), this is the moderator path, so it stamps the row:
        // that stamp is what stops join() from putting them straight back.
        $participant->update([
            'is_active' => false,
            'left_at' => now(),
            'last_seen_at' => now(),
            'removed_at' => now(),
        ]);

        $this->broadcast($stream, 'left', $participant, ['reason' => 'removed']);

        return $ok;
    }

    /**
     * Reconcile presence against the media server roster.
     */
    public function reconcile(LiveStream $stream): int
    {
        if (! $this->liveKit->isConfigured()) {
            return 0;
        }

        $identities = $this->liveKit->identitiesInRoom($stream->livekit_room);

        // An empty media roster is not evidence that everyone has left: the
        // media server can report zero while it is restarting or mid-rebalance.
        // Ageing the roster on that evidence would clear a live audience, so
        // staleness is only reaped when the media server actually answered.
        if ($identities === []) {
            return 0;
        }

        $liveUserIds = [];
        foreach ($identities as $identity) {
            // Anchored, so only identities we minted are counted. A loose digit
            // match would read "guest-42" or "user_1_backup" as a real user and
            // keep a stranger's presence row alive.
            if (preg_match('/^user_(\d+)$/', (string) $identity, $matches) === 1) {
                $liveUserIds[] = (int) $matches[1];
            }
        }

        if ($liveUserIds === []) {
            // Connected, but nobody we recognise. Same reasoning as above: this
            // is not proof that our roster is stale.
            return 0;
        }

        // Presence confirmed by the media server: refresh the heartbeat so a
        // long-running stream does not expire participants who are demonstrably
        // still connected.
        LiveStreamParticipant::query()
            ->where('live_stream_id', $stream->id)
            ->where('is_active', true)
            ->whereIn('user_id', $liveUserIds)
            ->update(['last_seen_at' => now()]);

        $removed = 0;
        LiveStreamParticipant::query()
            ->where('live_stream_id', $stream->id)
            ->where('is_active', true)
            ->when($liveUserIds !== [], fn ($query) => $query->whereNotIn('user_id', $liveUserIds))
            ->get()
            ->each(function (LiveStreamParticipant $participant) use ($stream, &$removed) {
                $participant->update([
                    'is_active' => false,
                    'left_at' => now(),
                    'last_seen_at' => now(),
                ]);
                $this->broadcast($stream, 'left', $participant, ['reason' => 'reconciled']);
                $removed++;
            });

        $this->expireStale($stream);

        return $removed;
    }

    public function expireStale(LiveStream $stream): int
    {
        $stale = LiveStreamParticipant::query()
            ->where('live_stream_id', $stream->id)
            ->where('is_active', true)
            ->where(function ($query) {
                $query->whereNull('last_seen_at')
                    ->orWhere('last_seen_at', '<', now()->subSeconds(LiveKitAdminService::PRESENCE_TTL_SECONDS));
            })
            ->get();

        foreach ($stale as $participant) {
            $participant->update([
                'is_active' => false,
                'left_at' => now(),
                'last_seen_at' => now(),
            ]);
            $this->broadcast($stream, 'left', $participant, ['reason' => 'expired']);
        }

        return $stale->count();
    }

    /**
     * LiveKit identity used for a participant (matches the token issuance).
     */
    public function identityFor(LiveStreamParticipant $participant): string
    {
        return 'user_'.$participant->user_id;
    }

    /**
     * Recompute the denormalised viewer counters after presence changes.
     */
    public function refreshCounts(LiveStream $stream): int
    {
        $active = LiveStreamParticipant::query()
            ->where('live_stream_id', $stream->id)
            ->where('is_active', true)
            ->count();

        $stream->update([
            'viewers_count' => $active,
            'peak_viewers' => max((int) $stream->peak_viewers, $active),
        ]);

        return $active;
    }

    public function broadcast(
        LiveStream $stream,
        string $action,
        LiveStreamParticipant $participant,
        array $meta = [],
    ): void {
        try {
            // Only the participant who changed, plus the count. The full roster
            // is deliberately not attached: this fires on every join, leave and
            // state change, so a large stream would re-serialise the entire
            // audience each time and fan it out to every subscriber. Clients
            // that need the roster fetch GET /live/{id}/participants.
            LiveStreamParticipantPresence::dispatch(
                (int) $stream->id,
                $action,
                $participant,
                $participant->toPresencePayload(),
                $meta + ['participant_count' => $this->refreshCounts($stream)],
            );
        } catch (\Throwable $e) {
            \Log::warning('[LiveStreamPresence] broadcast failed: '.$e->getMessage(), [
                'stream_id' => $stream->id,
                'action' => $action,
            ]);
        }
    }

    private function query(LiveStream $stream): Builder
    {
        return LiveStreamParticipant::query()
            ->with('user:id,name,username,avatar,avatar_url')
            ->where('live_stream_id', $stream->id)
            ->orderByRaw("CASE role WHEN 'host' THEN 0 WHEN 'co_host' THEN 1 WHEN 'moderator' THEN 2 ELSE 3 END")
            ->orderBy('joined_at');
    }
}
