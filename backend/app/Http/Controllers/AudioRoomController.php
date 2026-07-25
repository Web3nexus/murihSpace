<?php

namespace App\Http\Controllers;

use App\Models\AudioRoom;
use App\Models\AudioRoomParticipant;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AudioRoomController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = AudioRoom::with('creator:id,name,username,avatar_url')
            ->withCount('activeParticipants');

        if ($request->community_id) {
            $query->forCommunity($request->integer('community_id'));
        }

        if ($request->status && in_array($request->status, AudioRoom::STATUSES)) {
            $query->where('status', $request->status);
        }

        $rooms = $query->latest('scheduled_at')->get();

        return response()->json(['data' => $rooms]);
    }

    public function myRooms(Request $request): JsonResponse
    {
        $rooms = AudioRoom::with('community:id,name')
            ->withCount('activeParticipants')
            ->where('creator_id', $request->user()->id)
            ->latest()
            ->get();

        return response()->json(['data' => $rooms]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'community_id' => ['nullable', 'integer', 'exists:communities,id'],
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:5000'],
            'cover_url' => ['nullable', 'string', 'url', 'max:2000'],
            'scheduled_at' => ['nullable', 'date', 'after:now'],
            'max_participants' => ['nullable', 'integer', 'min:1', 'max:10000'],
            'is_recorded' => ['nullable', 'boolean'],
        ]);

        $validated['creator_id'] = $request->user()->id;
        $validated['status'] = $validated['scheduled_at'] ? 'scheduled' : 'scheduled';
        $validated['is_recorded'] ??= false;

        $room = AudioRoom::create($validated);

        // Creator auto-joins as host
        AudioRoomParticipant::create([
            'audio_room_id' => $room->id,
            'user_id' => $request->user()->id,
            'role' => 'host',
            'joined_at' => now(),
        ]);

        $room->load('creator:id,name,username,avatar_url');
        $room->loadCount('activeParticipants');

        return response()->json(['data' => $room], 201);
    }

    public function show(Request $request, int $id): JsonResponse
    {
        $room = AudioRoom::with([
            'creator:id,name,username,avatar_url',
            'community:id,name,slug',
            'participants' => fn ($q) => $q->whereNull('left_at')->with('user:id,name,username,avatar_url'),
        ])
            ->withCount('activeParticipants')
            ->findOrFail($id);

        return response()->json(['data' => $room]);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $room = AudioRoom::findOrFail($id);

        if ($room->creator_id !== $request->user()->id) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        if (in_array($room->status, ['ended', 'cancelled'])) {
            return response()->json(['message' => 'Cannot update an ended or cancelled room.'], 400);
        }

        $validated = $request->validate([
            'title' => ['sometimes', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:5000'],
            'cover_url' => ['nullable', 'string', 'url', 'max:2000'],
            'scheduled_at' => ['nullable', 'date', 'after:now'],
            'max_participants' => ['nullable', 'integer', 'min:1', 'max:10000'],
            'is_recorded' => ['nullable', 'boolean'],
            'status' => ['nullable', 'in:scheduled,live,ended,cancelled'],
        ]);

        $room->update($validated);

        return response()->json(['data' => $room->fresh()->loadCount('activeParticipants')]);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $room = AudioRoom::findOrFail($id);

        if ($room->creator_id !== $request->user()->id) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        if ($room->status === 'live') {
            return response()->json(['message' => 'End the room first before deleting.'], 409);
        }

        $room->delete();

        return response()->json(['message' => 'Room deleted.']);
    }

    public function start(Request $request, int $id): JsonResponse
    {
        $room = AudioRoom::findOrFail($id);

        if ($room->creator_id !== $request->user()->id) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        if (! in_array($room->status, ['scheduled'])) {
            return response()->json(['message' => 'Room cannot be started.'], 400);
        }

        $room->update(['status' => 'live', 'started_at' => now()]);

        return response()->json(['data' => $room->fresh()->loadCount('activeParticipants')]);
    }

    public function end(Request $request, int $id): JsonResponse
    {
        $room = AudioRoom::findOrFail($id);

        $isHost = $room->creator_id === $request->user()->id;
        $isCoHost = AudioRoomParticipant::where('audio_room_id', $id)
            ->where('user_id', $request->user()->id)
            ->where('role', 'co_host')
            ->whereNull('left_at')
            ->exists();

        if (! $isHost && ! $isCoHost) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        if ($room->status !== 'live') {
            return response()->json(['message' => 'Room is not live.'], 400);
        }

        $room->update(['status' => 'ended', 'ended_at' => now()]);
        AudioRoomParticipant::where('audio_room_id', $room->id)
            ->whereNull('left_at')
            ->update(['left_at' => now()]);

        return response()->json(['data' => $room->fresh()]);
    }

    public function join(Request $request, int $id): JsonResponse
    {
        $room = AudioRoom::findOrFail($id);

        if (! in_array($room->status, ['scheduled', 'live'])) {
            return response()->json(['message' => 'Room is not available to join.'], 400);
        }

        $existing = AudioRoomParticipant::where('audio_room_id', $room->id)
            ->where('user_id', $request->user()->id)
            ->first();

        if ($existing && ! $existing->left_at) {
            return response()->json(['message' => 'Already in this room.'], 409);
        }

        if ($room->max_participants) {
            $count = AudioRoomParticipant::where('audio_room_id', $room->id)
                ->whereNull('left_at')
                ->count();
            if ($count >= $room->max_participants) {
                return response()->json(['message' => 'Room is full.'], 409);
            }
        }

        if ($existing && $existing->left_at) {
            $existing->update(['left_at' => null, 'joined_at' => now(), 'is_muted' => true]);
        } else {
            AudioRoomParticipant::create([
                'audio_room_id' => $room->id,
                'user_id' => $request->user()->id,
                'role' => 'listener',
                'joined_at' => now(),
                'is_muted' => true,
            ]);
        }

        return response()->json(['message' => 'Joined room.']);
    }

    public function leave(Request $request, int $id): JsonResponse
    {
        $room = AudioRoom::findOrFail($id);

        $participant = AudioRoomParticipant::where('audio_room_id', $room->id)
            ->where('user_id', $request->user()->id)
            ->whereNull('left_at')
            ->first();

        if (! $participant) {
            return response()->json(['message' => 'Not in this room.'], 400);
        }

        if ($participant->role === 'host') {
            return response()->json(['message' => 'Host cannot leave. End the room instead.'], 400);
        }

        $participant->update(['left_at' => now()]);

        return response()->json(['message' => 'Left room.']);
    }

    public function updateRole(Request $request, int $id, int $userId): JsonResponse
    {
        $room = AudioRoom::findOrFail($id);

        $isHost = $room->creator_id === $request->user()->id;
        $isCoHost = AudioRoomParticipant::where('audio_room_id', $id)
            ->where('user_id', $request->user()->id)
            ->where('role', 'co_host')
            ->whereNull('left_at')
            ->exists();

        if (! $isHost && ! $isCoHost) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $validated = $request->validate([
            'role' => ['required', 'in:co_host,speaker,listener'],
        ]);

        $participant = AudioRoomParticipant::where('audio_room_id', $room->id)
            ->where('user_id', $userId)
            ->whereNull('left_at')
            ->first();

        if (! $participant) {
            return response()->json(['message' => 'User is not in this room.'], 404);
        }

        if ($participant->role === 'host') {
            return response()->json(['message' => 'Cannot change host role.'], 400);
        }

        $participant->update(['role' => $validated['role']]);

        return response()->json(['message' => "Role changed to {$validated['role']}."]);
    }

    public function toggleMute(Request $request, int $id, int $userId): JsonResponse
    {
        $room = AudioRoom::findOrFail($id);

        $isHost = $room->creator_id === $request->user()->id;
        $isCoHost = AudioRoomParticipant::where('audio_room_id', $id)
            ->where('user_id', $request->user()->id)
            ->where('role', 'co_host')
            ->whereNull('left_at')
            ->exists();

        if (! $isHost && ! $isCoHost) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $participant = AudioRoomParticipant::where('audio_room_id', $room->id)
            ->where('user_id', $userId)
            ->whereNull('left_at')
            ->first();

        if (! $participant) {
            return response()->json(['message' => 'User not found in room.'], 404);
        }

        $participant->update(['is_muted' => ! $participant->is_muted]);

        return response()->json([
            'message' => $participant->is_muted ? 'User muted.' : 'User unmuted.',
            'is_muted' => $participant->is_muted,
        ]);
    }

    public function raiseHand(Request $request, int $id): JsonResponse
    {
        $participant = AudioRoomParticipant::where('audio_room_id', $id)
            ->where('user_id', $request->user()->id)
            ->whereNull('left_at')
            ->first();

        if (! $participant) {
            return response()->json(['message' => 'Not in this room.'], 400);
        }

        $participant->update(['is_hand_raised' => ! $participant->is_hand_raised]);

        return response()->json([
            'message' => $participant->is_hand_raised ? 'Hand raised.' : 'Hand lowered.',
            'is_hand_raised' => $participant->is_hand_raised,
        ]);
    }
}
