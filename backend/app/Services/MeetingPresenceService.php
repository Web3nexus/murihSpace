<?php

namespace App\Services;

use App\Events\MeetingParticipantJoined;
use App\Events\MeetingParticipantLeft;
use App\Events\MeetingParticipantUpdated;
use App\Exceptions\RemovedFromSessionException;
use App\Models\Meeting;
use App\Models\MeetingParticipant;
use Illuminate\Database\Eloquent\Builder;

/**
 * Single source of truth for who is inside a meeting.
 *
 * Both clients (web LiveKit room state and the Flutter conference screen) read
 * from here rather than from their own local bookkeeping, which is what makes a
 * late joiner immediately receive the current roster and an existing attendee
 * immediately learn about the new arrival.
 */
class MeetingPresenceService
{
    public function __construct(private readonly LiveKitAdminService $liveKit) {}

    /**
     * Register (or restore) an attendee and announce the arrival.
     */
    public function join(Meeting $meeting, int $userId, array $attributes = []): MeetingParticipant
    {
        $isHost = (int) $meeting->host_user_id === $userId;
        $existing = MeetingParticipant::query()
            ->where('meeting_id', $meeting->id)
            ->where('user_id', $userId)
            ->first();
        $wasActive = (bool) ($existing?->is_active);

        $requestedRole = (string) ($attributes['role'] ?? MeetingParticipant::ROLE_PARTICIPANT);

        // A role may be raised but never lowered by re-joining: only the explicit
        // host role endpoint may demote somebody. Without this a reconnect (or a
        // second tab) silently strips a promotion the host just granted.
        // Removal is sticky for the lifetime of the meeting. The upsert below
        // would otherwise set is_active back to true and put a participant the
        // host just ejected straight back on the roster. The row cascades away
        // with the meeting, so this is per-session, not a ban.
        if ($existing && $existing->removed_at !== null) {
            throw new RemovedFromSessionException('meeting', $meeting->code);
        }

        $role = match (true) {
            $isHost => MeetingParticipant::ROLE_HOST,
            $existing?->role === MeetingParticipant::ROLE_HOST => MeetingParticipant::ROLE_HOST,
            $existing?->role === MeetingParticipant::ROLE_CO_HOST => MeetingParticipant::ROLE_CO_HOST,
            $existing?->role === MeetingParticipant::ROLE_MODERATOR => MeetingParticipant::ROLE_MODERATOR,
            default => $requestedRole,
        };

        $participant = MeetingParticipant::updateOrCreate(
            [
                'meeting_id' => $meeting->id,
                'user_id' => $userId,
            ],
            array_merge([
                'role' => $role,
                'is_active' => true,
                'left_at' => null,
                // Keep the original join time so a reconnect (or a second tab)
                // does not reshuffle the roster ordering.
                'joined_at' => $existing?->joined_at ?? now(),
                'last_seen_at' => now(),
            ], array_diff_key($attributes, ['role' => null, 'is_active' => null, 'left_at' => null, 'joined_at' => null, 'last_seen_at' => null, 'removed_at' => null]))
        );

        // A reconnect must not replay a spurious "joined" announcement.
        if (! $wasActive) {
            $this->broadcastJoined($meeting, $participant);
        } else {
            $this->broadcastUpdated($meeting, $participant, 'reconnected');
        }

        return $participant;
    }

    /**
     * Update mic/camera/hand state for a participant.
     */
    public function updateState(Meeting $meeting, int $userId, array $state): ?MeetingParticipant
    {
        // State updates are not a way in. Creating the row here would let a
        // participant who had left — or been removed by a moderator — put
        // themselves straight back into the roster by posting a mute flag,
        // bypassing join() and whatever the moderator decided. Returns null when
        // there is no active row; the caller turns that into a conflict.
        $participant = MeetingParticipant::query()
            ->where('meeting_id', $meeting->id)
            ->where('user_id', $userId)
            ->where('is_active', true)
            ->first();

        if (! $participant) {
            return null;
        }

        $changed = false;
        foreach (['is_muted', 'is_camera_on'] as $field) {
            if (array_key_exists($field, $state)) {
                $value = (bool) $state[$field];
                if ($participant->{$field} !== $value) {
                    $participant->{$field} = $value;
                    $changed = true;
                }
            }
        }

        $participant->last_seen_at = now();
        $participant->save();

        if ($changed) {
            $this->broadcastUpdated($meeting, $participant, 'state');
        }

        return $participant;
    }

    /**
     * Mark an attendee as gone. A missing row is not an error — leaving twice,
     * or leaving after the meeting was already torn down, must stay idempotent.
     */
    public function leave(Meeting $meeting, int $userId): ?MeetingParticipant
    {
        $participant = MeetingParticipant::query()
            ->where('meeting_id', $meeting->id)
            ->where('user_id', $userId)
            ->first();

        if (! $participant || ! $participant->is_active) {
            return $participant;
        }

        // Deliberately does not touch `removed_at`: leave() is also the path a
        // voluntary departure takes, and a moderator's stamp must survive it.
        $participant->update([
            'is_active' => false,
            'left_at' => now(),
            'last_seen_at' => now(),
        ]);

        try {
            MeetingParticipantLeft::dispatch($meeting->code, $participant, $this->roster($meeting));
        } catch (\Throwable $e) {
            \Log::warning('[MeetingPresence] join/leave broadcast failed: '.$e->getMessage(), [
                'meeting_id' => $meeting->id,
            ]);
        }

        return $participant;
    }

    /**
     * Remove a participant at a moderator's request.
     *
     * Unlike leave(), this stamps `removed_at`, which join() honours. Without
     * that the host's kick was undone by the participant's very next request.
     */
    public function remove(Meeting $meeting, int $userId): ?MeetingParticipant
    {
        $participant = $this->leave($meeting, $userId);

        if (! $participant) {
            return null;
        }

        if ($participant->removed_at === null) {
            $participant->update(['removed_at' => now()]);
        }

        return $participant;
    }

    /**
     * Current roster, ordered host-first then join order.
     *
     * @return array<int, array<string, mixed>>
     */
    public function roster(Meeting $meeting): array
    {
        return $this->query($meeting)->get()->map(
            fn (MeetingParticipant $participant) => $participant->toPresencePayload()
        )->all();
    }

    public function participantFor(Meeting $meeting, int $userId): ?MeetingParticipant
    {
        return MeetingParticipant::query()
            ->where('meeting_id', $meeting->id)
            ->where('user_id', $userId)
            ->first();
    }

    /**
     * Server-side authorization for every moderation action. Returns the caller
     * as a participant when they are allowed to moderate, `null` otherwise.
     */
    public function moderatorFor(Meeting $meeting, int $userId, bool $isAdmin = false): ?MeetingParticipant
    {
        $participant = $this->participantFor($meeting, $userId);

        if ($participant && $participant->canModerate()) {
            return $participant;
        }

        // Admins keep oversight even without a roster row.
        if ($isAdmin || (int) $meeting->host_user_id === $userId) {
            return $participant ?? MeetingParticipant::make([
                'meeting_id' => $meeting->id,
                'user_id' => $userId,
                'role' => MeetingParticipant::ROLE_HOST,
                'is_active' => true,
            ]);
        }

        return null;
    }

    public function broadcastJoined(Meeting $meeting, MeetingParticipant $participant): void
    {
        try {
            MeetingParticipantJoined::dispatch($meeting->code, $participant, $this->roster($meeting));
        } catch (\Throwable $e) {
            \Log::warning('[MeetingPresence] join broadcast failed: '.$e->getMessage(), [
                'meeting_id' => $meeting->id,
            ]);
        }
    }

    public function broadcastUpdated(
        Meeting $meeting,
        MeetingParticipant $participant,
        string $reason = 'state',
        ?array $target = null,
    ): void {
        try {
            MeetingParticipantUpdated::dispatch(
                $meeting->code,
                $participant,
                $this->roster($meeting),
                $reason,
                $target,
            );
        } catch (\Throwable $e) {
            \Log::warning('[MeetingPresence] update broadcast failed: '.$e->getMessage(), [
                'meeting_id' => $meeting->id,
            ]);
        }
    }

    /**
     * Reconcile persisted presence with the media server.
     *
     * If LiveKit can be reached, the room roster is authoritative — a browser
     * that vanished without sending `leave` (closed tab, crashed process) is
     * dropped here instead of lingering as a ghost participant forever.
     */
    public function reconcile(Meeting $meeting): void
    {
        if (! $this->liveKit->isConfigured()) {
            return;
        }

        $identities = $this->liveKit->identitiesInRoom($meeting->room);

        if ($identities === []) {
            // Media server unreachable or room empty: fall back to the presence
            // TTL so a transient outage never wipes the roster.
            $this->expireStale($meeting);

            return;
        }

        $liveUserIds = [];
        foreach ($identities as $identity) {
            // Meetings use the bare user id as identity; live broadcasts use
            // "user_{id}". Accept both shapes rather than assuming one.
            if (preg_match('/(\d+)/', $identity, $matches) === 1) {
                $liveUserIds[] = (int) $matches[1];
            }
        }

        MeetingParticipant::query()
            ->where('meeting_id', $meeting->id)
            ->where('is_active', true)
            ->when($liveUserIds !== [], fn ($query) => $query->whereNotIn('user_id', $liveUserIds))
            ->get()
            ->each(fn (MeetingParticipant $participant) => $this->leave($meeting, (int) $participant->user_id));

        $this->expireStale($meeting);
    }

    /**
     * Mark participants silent for longer than the TTL as gone. Used when the
     * media server cannot be consulted.
     */
    public function expireStale(Meeting $meeting): int
    {
        $stale = MeetingParticipant::query()
            ->where('meeting_id', $meeting->id)
            ->where('is_active', true)
            ->where(function ($query) {
                $query->whereNull('last_seen_at')
                    ->orWhere('last_seen_at', '<', now()->subSeconds(LiveKitAdminService::PRESENCE_TTL_SECONDS));
            })
            ->get();

        foreach ($stale as $participant) {
            $this->leave($meeting, (int) $participant->user_id);
        }

        return $stale->count();
    }

    private function query(Meeting $meeting): Builder
    {
        return MeetingParticipant::query()
            ->with('user:id,name,username,avatar,avatar_url')
            ->where('meeting_id', $meeting->id)
            ->orderByRaw("CASE role WHEN 'host' THEN 0 WHEN 'co_host' THEN 1 WHEN 'moderator' THEN 2 ELSE 3 END")
            ->orderBy('joined_at');
    }
}
