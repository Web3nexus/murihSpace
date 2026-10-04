<?php

namespace App\Http\Controllers;

use App\Events\MeetingEnded;
use App\Exceptions\RemovedFromSessionException;
use App\Models\Meeting;
use App\Models\MeetingParticipant;
use App\Services\LiveKitAdminService;
use App\Services\LiveKitService;
use App\Services\MeetingPresenceService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class MeetingController extends Controller
{
    public function __construct(
        private readonly LiveKitService $liveKitService,
        private readonly MeetingPresenceService $presence,
        private readonly LiveKitAdminService $liveKitAdmin,
    ) {}

    /**
     * Start an instant meeting room.
     */
    public function instant(Request $request): JsonResponse
    {
        $user = $request->user();

        if (! $user || ! $user->isCreatorOrAdmin()) {
            return response()->json([
                'success' => false,
                'message' => 'Only creators and administrators can host meetings. Normal members can join meetings using an invite link or room code.',
            ], 403);
        }

        $title = $request->input('title') ?: ($user->name . "'s Meeting");

        // Generate a Google Meet style code (e.g. abc-defg-hij)
        $part1 = Str::lower(Str::random(3));
        $part2 = Str::lower(Str::random(4));
        $part3 = Str::lower(Str::random(3));
        $code = "{$part1}-{$part2}-{$part3}";
        $roomName = "meeting-{$code}";

        try {
            // Persist the ephemeral meeting so joiners can be validated against
            // a real, active room instead of silently minting a token for any
            // code (which stranded guests in empty rooms that looked connected).
            $expiresAt = now()->addHours(8);
            $meeting = Meeting::create([
                'code' => $code,
                'host_user_id' => $user->id,
                'room' => $roomName,
                'title' => $title,
                'expires_at' => $expiresAt,
            ]);

            // The host's presence row is created up front so the host is a
            // moderator from the very first render, and so the room has a
            // non-empty roster even before the media socket is up.
            $this->presence->join($meeting, (int) $user->id, ['role' => MeetingParticipant::ROLE_HOST]);

            $token = $this->liveKitService->generateToken(
                identity: (string) $user->id,
                roomName: $roomName,
                metadata: json_encode([
                    'user_id' => $user->id,
                    'name' => $user->name,
                    'username' => $user->username ?? '',
                    'role' => MeetingParticipant::ROLE_HOST,
                ]),
                canPublish: true,
                canSubscribe: true,
                name: $user->name,
                // Not room-admin, despite being the host. Moderation is enforced
                // server-side against the roster; a client-side grant would only
                // create a path around those checks, and no client reads it.
                roomAdmin: false,
            );

            $host = config('livekit.host') ?: env('LIVEKIT_HOST', 'http://localhost:7880');

            $payload = [
                'code' => $code,
                'room' => $roomName,
                'title' => $title,
                'token' => $token,
                'host' => $host,
                'host_user_id' => $user->id,
                'is_host' => true,
                'can_moderate' => true,
                'meeting_url' => "/app/meeting/{$code}",
            ];

            return response()->json([
                'success' => true,
                'data' => array_merge($payload, ['participants' => $this->presence->roster($meeting)]),
            ] + $payload);
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 503);
        }
    }

    /**
     * Join an existing meeting room by code.
     *
     * Returning the roster here is what fixes the "joiner sees nobody, and the
     * existing attendee never sees the joiner" problem: presence is recorded
     * and broadcast from this endpoint, and the joiner is handed the full list
     * instead of relying on whatever its local LiveKit room state happens to
     * contain at that instant.
     */
    public function token(Request $request, string $code): JsonResponse
    {
        $code = trim(strtolower($code));

        // Only mint tokens for rooms that were actually created via
        // `/meetings/instant` and have not expired. Unknown codes now produce a
        // clear error instead of a connected-but-empty room on another server.
        $meeting = Meeting::query()->active()->where('code', $code)->first();

        if (! $meeting) {
            return response()->json([
                'success' => false,
                'message' => 'Meeting room not found or has ended. Ask the host to share a fresh invite link.',
            ], 404);
        }

        $user = $request->user();
        $roomName = $meeting->room;
        $isHost = (int) $meeting->host_user_id === (int) $user->id;

        try {
            // Join presence BEFORE the token is minted so a participant that
            // connects immediately already has a row (and a host flag) waiting.
            $participant = $this->presence->join($meeting, (int) $user->id, [
                'role' => $isHost ? MeetingParticipant::ROLE_HOST : MeetingParticipant::ROLE_PARTICIPANT,
            ]);

            $token = $this->liveKitService->generateToken(
                identity: (string) $user->id,
                roomName: $roomName,
                metadata: json_encode([
                    'user_id' => $user->id,
                    'name' => $user->name,
                    'username' => $user->username ?? '',
                    'role' => $participant->role,
                ]),
                // A host's restriction must survive a rejoin: minting a
                // publish-capable token again would silently undo it.
                canPublish: ! $participant->is_restricted,
                canSubscribe: true,
                name: $user->name,
                // Never room-admin. Every moderation action is enforced by
                // LiveKitAdminService against the server roster; handing the
                // client LiveKit admin rights would let it bypass those checks,
                // and nothing in either client reads the flag.
                roomAdmin: false,
            );

            $host = config('livekit.host') ?: env('LIVEKIT_HOST', 'http://localhost:7880');

            $payload = [
                'code' => $code,
                'room' => $roomName,
                'title' => $meeting->title,
                'token' => $token,
                'host' => $host,
                'is_host' => $isHost,
                'can_moderate' => $participant->canModerate(),
                'role' => $participant->role,
                'participants' => $this->presence->roster($meeting),
            ];

            return response()->json([
                'success' => true,
                'data' => $payload,
            ] + $payload);
        } catch (RemovedFromSessionException $e) {
            // Re-thrown ahead of the catch below, which reports every
            // RuntimeException as "media server unavailable" (503). A removed
            // participant is a permission answer (403), and swallowing it here
            // would both mislead the client and re-open the door the removal
            // stamp was added to close.
            throw $e;
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 503);
        }
    }

    /**
     * Lightweight room metadata used by link previews and "who is in this
     * meeting" checks without minting a media token.
     */
    public function show(Request $request, string $code): JsonResponse
    {
        $code = trim(strtolower($code));
        $meeting = Meeting::query()->active()->where('code', $code)->first();

        if (! $meeting) {
            return response()->json([
                'success' => false,
                'message' => 'Meeting room not found or has ended.',
            ], 404);
        }

        return response()->json([
            'success' => true,
            'data' => [
                'type' => 'meeting',
                'code' => $meeting->code,
                'room' => $meeting->room,
                'title' => $meeting->title,
                'host' => $meeting->host ? [
                    'id' => $meeting->host->id,
                    'name' => $meeting->host->name,
                    'username' => $meeting->host->username,
                    'avatar_url' => $meeting->host->avatar_url ?? $meeting->host->avatar,
                ] : null,
                'participant_count' => $meeting->activeParticipants()->count(),
                'expires_at' => $meeting->expires_at?->toIso8601String(),
                'meeting_url' => '/app/meeting/'.$meeting->code,
            ],
        ]);
    }

    /**
     * Current roster for a meeting.
     */
    public function participants(Request $request, string $code): JsonResponse
    {
        $meeting = $this->findActiveOrFail($code);
        $userId = (int) $request->user()->id;

        // Read-only. This used to join as a side effect, which made a plain GET
        // able to add rows to the roster and resurrect a participant a
        // moderator had just removed. Joining is POST /{code}/join.
        return response()->json([
            'success' => true,
            'data' => [
                'code' => $meeting->code,
                'is_host' => $this->roleFor($meeting, $userId) === MeetingParticipant::ROLE_HOST,
                'participants' => $this->presence->roster($meeting),
            ],
        ]);
    }

    /**
     * Join the meeting's presence roster.
     *
     * Throws RemovedFromSessionException when a moderator has removed this
     * user from the meeting; that becomes a 403 via the API exception handler.
     */
    public function join(Request $request, string $code): JsonResponse
    {
        $meeting = $this->findActiveOrFail($code);
        $userId = (int) $request->user()->id;

        $participant = $this->presence->join($meeting, $userId, [
            'role' => $this->roleFor($meeting, $userId),
        ]);

        return response()->json([
            'success' => true,
            'data' => [
                'code' => $meeting->code,
                'is_host' => $participant->role === MeetingParticipant::ROLE_HOST,
                'participant' => $participant->toPresencePayload(),
                'participants' => $this->presence->roster($meeting),
            ],
        ]);
    }

    /**
     * Report local mic/camera state so other clients (and a host's moderation
     * panel) can show accurate status instead of guessing from tracks.
     */
    public function state(Request $request, string $code): JsonResponse
    {
        $validated = $request->validate([
            'is_muted' => ['sometimes', 'boolean'],
            'is_camera_on' => ['sometimes', 'boolean'],
        ]);

        $meeting = $this->findActiveOrFail($code);
        $user = $request->user();

        $participant = $this->presence->updateState($meeting, (int) $user->id, $validated);

        if (! $participant) {
            return response()->json([
                'message' => 'You are not an active participant in this meeting.',
            ], 409);
        }

        return response()->json([
            'success' => true,
            'data' => [
                'participant' => $participant->toPresencePayload(),
                'participants' => $this->presence->roster($meeting),
            ],
        ]);
    }

    /**
     * Explicit leave. The client only calls this on an intentional exit — a
     * navigation or tab switch must NOT reach this endpoint, which is what used
     * to make a meeting look "ended" whenever the user browsed away.
     */
    public function leave(Request $request, string $code): JsonResponse
    {
        $code = trim(strtolower($code));
        $meeting = Meeting::query()->active()->where('code', $code)->first();

        if (! $meeting) {
            // Idempotent: leaving an already-ended room is not an error.
            return response()->json(['success' => true, 'message' => 'Left meeting.']);
        }

        $this->presence->leave($meeting, (int) $request->user()->id);

        return response()->json(['success' => true, 'message' => 'Left meeting.']);
    }

    /**
     * Force a participant's microphone off. Host/co-host/moderator only.
     */
    public function muteParticipant(Request $request, string $code, int $userId): JsonResponse
    {
        $meeting = $this->findActiveOrFail($code);
        $actor = $this->authorizeModerator($request, $meeting);

        if ($userId === (int) $meeting->host_user_id) {
            return response()->json(['message' => 'The meeting host cannot be muted.'], 403);
        }

        $target = $this->presence->participantFor($meeting, $userId);

        if (! $target) {
            return response()->json(['message' => 'That participant is not in this meeting.'], 404);
        }

        $this->liveKitAdmin->muteParticipant($meeting->room, (string) $userId);

        $target->update(['is_muted' => true, 'last_seen_at' => now()]);
        $this->presence->broadcastUpdated($meeting, $target, 'muted', [
            'actor_id' => (int) $actor->user_id,
            'user_id' => $userId,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Participant microphone muted.',
            'data' => ['participants' => $this->presence->roster($meeting)],
        ]);
    }

    /**
     * Revoke or restore a participant's ability to publish (mic/camera).
     */
    public function restrictParticipant(Request $request, string $code, int $userId): JsonResponse
    {
        $validated = $request->validate([
            'restricted' => ['required', 'boolean'],
        ]);

        $meeting = $this->findActiveOrFail($code);
        $actor = $this->authorizeModerator($request, $meeting);

        if ($userId === (int) $meeting->host_user_id) {
            return response()->json(['message' => 'The meeting host cannot be restricted.'], 403);
        }

        $target = $this->presence->participantFor($meeting, $userId);

        if (! $target) {
            return response()->json(['message' => 'That participant is not in this meeting.'], 404);
        }

        if ((int) $actor->user_id === $userId) {
            return response()->json(['message' => 'You cannot change your own access.'], 403);
        }

        $restricted = (bool) $validated['restricted'];

        // The roster flag is a mirror of LiveKit permissions, so a media-server
        // refusal must not be recorded as if it succeeded — otherwise the host
        // sees "restricted" while the participant keeps publishing.
        $mediaSynced = $restricted
            ? $this->liveKitAdmin->restrictParticipant($meeting->room, (string) $userId)
            : $this->liveKitAdmin->unrestrictParticipant($meeting->room, (string) $userId);

        if ($this->liveKitAdmin->isConfigured() && ! $mediaSynced) {
            return response()->json([
                'message' => 'The meeting service is unavailable, so access could not be changed. Try again shortly.',
            ], 503);
        }

        $target->update([
            'is_restricted' => $restricted,
            // Revoking publish rights unpublishes existing tracks server-side,
            // so mirror that in the roster state clients render.
            'is_muted' => $restricted ? true : (bool) $target->is_muted,
            'last_seen_at' => now(),
        ]);

        $this->presence->broadcastUpdated($meeting, $target, $restricted ? 'restricted' : 'unrestricted', [
            'actor_id' => (int) $actor->user_id,
            'user_id' => $userId,
        ]);

        return response()->json([
            'success' => true,
            'message' => $restricted ? 'Participant restricted.' : 'Participant access restored.',
            'data' => ['participants' => $this->presence->roster($meeting)],
        ]);
    }

    /**
     * Promote/demote a participant between moderator-capable roles.
     */
    public function updateRole(Request $request, string $code, int $userId): JsonResponse
    {
        $validated = $request->validate([
            'role' => ['required', 'string', Rule::in([
                MeetingParticipant::ROLE_CO_HOST,
                MeetingParticipant::ROLE_MODERATOR,
                MeetingParticipant::ROLE_PARTICIPANT,
            ])],
        ]);

        $meeting = $this->findActiveOrFail($code);

        // Deliberately stricter than authorizeModerator, which admits moderators.
        // A moderator able to promote somebody to co-host is a privilege ladder:
        // the target then outranks the actor and can strip the very role that let
        // the promotion happen. Role assignment is the host's call.
        $actor = $request->user();
        $isHost = (int) $meeting->host_user_id === (int) $actor->id;
        if (! $isHost && ! $actor->isAdmin()) {
            abort(403, 'Only the meeting host can change participant roles.');
        }

        if ($userId === (int) $meeting->host_user_id) {
            return response()->json(['message' => 'The meeting host role cannot be changed.'], 403);
        }

        if ((int) $actor->user_id === $userId) {
            return response()->json(['message' => 'You cannot change your own role.'], 403);
        }

        $target = $this->presence->participantFor($meeting, $userId);

        if (! $target) {
            return response()->json(['message' => 'That participant is not in this meeting.'], 404);
        }

        $role = $validated['role'];
        $target->update(['role' => $role, 'last_seen_at' => now()]);

        // Keep LiveKit metadata in step so clients that read the token metadata
        // (the Flutter screen does) agree with the server roster.
        $this->liveKitAdmin->updateParticipantMetadata($meeting->room, (string) $userId, (string) json_encode([
            'user_id' => $userId,
            'name' => $target->user?->name,
            'role' => $role,
        ]));

        $this->presence->broadcastUpdated($meeting, $target, 'role_changed', [
            'actor_id' => (int) $actor->user_id,
            'user_id' => $userId,
            'role' => $role,
        ]);

        return response()->json([
            'success' => true,
            'message' => "Participant role changed to {$role}.",
            'data' => ['participants' => $this->presence->roster($meeting)],
        ]);
    }

    /**
     * Remove a participant from the meeting room.
     */
    public function removeParticipant(Request $request, string $code, int $userId): JsonResponse
    {
        $meeting = $this->findActiveOrFail($code);
        $actor = $this->authorizeModerator($request, $meeting);

        if ($userId === (int) $meeting->host_user_id) {
            return response()->json(['message' => 'The meeting host cannot be removed.'], 403);
        }

        if ((int) $actor->user_id === $userId) {
            return response()->json(['message' => 'You cannot remove yourself. Use the end-meeting action instead.'], 403);
        }

        $target = $this->presence->participantFor($meeting, $userId);

        if (! $target) {
            return response()->json(['message' => 'That participant is not in this meeting.'], 404);
        }

        $this->liveKitAdmin->removeParticipant($meeting->room, (string) $userId);
        $this->presence->remove($meeting, $userId);

        return response()->json([
            'success' => true,
            'message' => 'Participant removed from the meeting.',
            'data' => ['participants' => $this->presence->roster($meeting)],
        ]);
    }

    /**
     * Host-only meeting lifecycle control.
     */
    public function end(Request $request, string $code): JsonResponse
    {
        $code = trim(strtolower($code));
        $meeting = Meeting::query()->where('code', $code)->first();

        if (! $meeting) {
            return response()->json(['message' => 'Meeting not found.'], 404);
        }

        $user = $request->user();

        if ((int) $meeting->host_user_id !== (int) $user->id && ! $user->isAdmin()) {
            return response()->json(['message' => 'Only the meeting host can end this meeting.'], 403);
        }

        // Expiring the meeting is what makes `/meetings/{code}/token` refuse new
        // joins, and it is what the clients poll to detect the room is over.
        $meeting->update(['expires_at' => now()]);

        $meeting->participants()->update([
            'is_active' => false,
            'left_at' => now(),
            'last_seen_at' => now(),
        ]);

        // Expiring the record is not enough: the media room is still live, so
        // every remaining client keeps a "connected" socket. Drop them from the
        // room so the teardown is real rather than cosmetic.
        $this->liveKitAdmin->removeAllParticipants($meeting->room, (string) $meeting->host_user_id);

        try {
            MeetingEnded::dispatch($meeting->code, [
                'reason' => 'host_ended',
                'ended_at' => now()->toIso8601String(),
            ]);
        } catch (\Throwable $e) {
            \Log::warning('[MeetingController] MeetingEnded broadcast failed: '.$e->getMessage(), [
                'meeting_code' => $meeting->code,
            ]);
        }

        return response()->json([
            'success' => true,
            'message' => 'Meeting ended for all participants.',
            'data' => ['code' => $meeting->code, 'ended_at' => now()->toIso8601String()],
        ]);
    }

    private function findActiveOrFail(string $code): Meeting
    {
        $meeting = Meeting::query()->active()->where('code', trim(strtolower($code)))->first();

        if (! $meeting) {
            abort(404, 'Meeting room not found or has ended.');
        }

        return $meeting;
    }

    private function roleFor(Meeting $meeting, int $userId): string
    {
        return (int) $meeting->host_user_id === $userId
            ? MeetingParticipant::ROLE_HOST
            : MeetingParticipant::ROLE_PARTICIPANT;
    }

    /**
     * Every moderation route funnels through here, so a viewer can never reach
     * a host API even by guessing the URL.
     */
    private function authorizeModerator(Request $request, Meeting $meeting): MeetingParticipant
    {
        $user = $request->user();
        $moderator = $this->presence->moderatorFor($meeting, (int) $user->id, (bool) $user->isAdmin());

        if (! $moderator) {
            abort(403, 'Only the meeting host or a moderator can perform this action.');
        }

        return $moderator;
    }
}
