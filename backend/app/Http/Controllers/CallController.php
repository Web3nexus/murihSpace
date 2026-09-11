<?php

namespace App\Http\Controllers;

use App\Events\CallAccepted;
use App\Events\CallDeclined;
use App\Events\CallEnded;
use App\Events\CallIncoming;
use App\Models\Call;
use App\Models\User;
use App\Models\UserBlock;
use App\Services\LiveKitService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class CallController extends Controller
{
    public function __construct(
        private readonly ?LiveKitService $liveKitService = null,
    ) {}

    /**
     * Initiate a new audio or video call.
     */
    public function initiate(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'recipient_id' => ['required', 'integer', 'exists:users,id'],
            'type' => ['nullable', 'string', 'in:audio,video'],
            'conversation_id' => ['nullable', 'integer', 'exists:conversations,id'],
        ]);

        $callerId = $request->user()->id;
        $recipientId = (int) $validated['recipient_id'];

        if ($callerId === $recipientId) {
            return response()->json(['message' => 'You cannot call yourself.'], 422);
        }

        // Check block relationship
        $isBlocked = UserBlock::where(function ($q) use ($callerId, $recipientId) {
            $q->where('blocker_id', $callerId)->where('blocked_id', $recipientId);
        })->orWhere(function ($q) use ($callerId, $recipientId) {
            $q->where('blocker_id', $recipientId)->where('blocked_id', $callerId);
        })->exists();

        if ($isBlocked) {
            return response()->json(['message' => 'Cannot place call to this user.'], 403);
        }

        $callType = $validated['type'] ?? 'audio';
        $roomName = 'call_' . $callerId . '_' . $recipientId . '_' . time() . '_' . Str::lower(Str::random(6));

        $call = Call::create([
            'caller_id' => $callerId,
            'recipient_id' => $recipientId,
            'conversation_id' => $validated['conversation_id'] ?? null,
            'type' => $callType,
            'status' => 'ringing',
            'room_name' => $roomName,
        ]);

        $call->load(['caller:id,name,username,avatar', 'recipient:id,name,username,avatar']);

        // Broadcast real-time incoming call event to recipient
        broadcast(new CallIncoming($call))->toOthers();

        // Optional LiveKit token for caller
        $livekitToken = null;
        if ($this->liveKitService) {
            try {
                $livekitToken = $this->liveKitService->generateToken(
                    roomName: $roomName,
                    participantIdentity: 'user_' . $callerId,
                    participantName: $request->user()->name,
                    canPublish: true,
                    canSubscribe: true,
                );
            } catch (\Throwable $e) {
                // Non-fatal if LiveKit not configured
            }
        }

        return response()->json([
            'call' => $call,
            'room_name' => $roomName,
            'livekit_token' => $livekitToken,
            'livekit_host' => config('livekit.host'),
        ], 201);
    }

    /**
     * Accept an incoming call.
     */
    public function accept(Request $request, int $id): JsonResponse
    {
        $call = Call::findOrFail($id);

        if ($call->recipient_id !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized to accept this call.'], 403);
        }

        if ($call->status !== 'ringing') {
            return response()->json(['message' => 'Call is no longer ringing.', 'status' => $call->status], 400);
        }

        $call->update([
            'status' => 'accepted',
            'started_at' => now(),
        ]);

        broadcast(new CallAccepted($call))->toOthers();

        $livekitToken = null;
        if ($this->liveKitService) {
            try {
                $livekitToken = $this->liveKitService->generateToken(
                    roomName: $call->room_name,
                    participantIdentity: 'user_' . $request->user()->id,
                    participantName: $request->user()->name,
                    canPublish: true,
                    canSubscribe: true,
                );
            } catch (\Throwable $e) {
                // Non-fatal
            }
        }

        return response()->json([
            'call' => $call,
            'livekit_token' => $livekitToken,
            'livekit_host' => config('livekit.host'),
        ]);
    }

    /**
     * Decline an incoming call.
     */
    public function decline(Request $request, int $id): JsonResponse
    {
        $call = Call::findOrFail($id);

        if ($call->recipient_id !== $request->user()->id && $call->caller_id !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        $call->update([
            'status' => 'declined',
            'ended_at' => now(),
        ]);

        broadcast(new CallDeclined($call))->toOthers();

        return response()->json([
            'call' => $call,
            'message' => 'Call declined.',
        ]);
    }

    /**
     * End an active call.
     */
    public function end(Request $request, int $id): JsonResponse
    {
        $call = Call::findOrFail($id);

        if ($call->recipient_id !== $request->user()->id && $call->caller_id !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        $duration = 0;
        if ($call->started_at) {
            $duration = max(0, now()->diffInSeconds($call->started_at));
        }

        $call->update([
            'status' => 'ended',
            'ended_at' => now(),
            'duration_seconds' => $duration,
        ]);

        broadcast(new CallEnded($call))->toOthers();

        return response()->json([
            'call' => $call,
            'message' => 'Call ended.',
        ]);
    }

    /**
     * Get details of a call.
     */
    public function show(Request $request, int $id): JsonResponse
    {
        $call = Call::with(['caller:id,name,username,avatar', 'recipient:id,name,username,avatar'])
            ->findOrFail($id);

        if ($call->recipient_id !== $request->user()->id && $call->caller_id !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        return response()->json([
            'call' => $call,
        ]);
    }
}
