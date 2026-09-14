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
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class CallController extends Controller
{
    public function __construct(
        private readonly ?LiveKitService $liveKitService = null,
    ) {}

    private function getLivekitHost(): string
    {
        $host = (string) config('livekit.host', 'https://live-staging.murihspace.com');
        $host = rtrim($host, '/');
        if (str_starts_with($host, 'https://')) {
            return 'wss://' . substr($host, 8);
        }
        if (str_starts_with($host, 'http://')) {
            return 'ws://' . substr($host, 7);
        }
        return $host;
    }

    private function resolveLivekitService(): ?LiveKitService
    {
        if ($this->liveKitService) {
            return $this->liveKitService;
        }

        try {
            return app(LiveKitService::class);
        } catch (\Throwable $e) {
            return null;
        }
    }

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

        // Generate LiveKit token for caller
        $livekitToken = null;
        $service = $this->resolveLivekitService();
        if ($service) {
            try {
                $livekitToken = $service->generateToken(
                    identity: 'user_' . $callerId,
                    roomName: $roomName,
                    metadata: json_encode([
                        'user_id' => $callerId,
                        'name' => $request->user()->name,
                        'call_id' => $call->id,
                        'type' => $callType,
                    ]),
                    canPublish: true,
                    canSubscribe: true,
                    name: $request->user()->name,
                );
            } catch (\Throwable $e) {
                Log::warning('[CallController] LiveKit token generation failed: ' . $e->getMessage());
            }
        }

        return response()->json([
            'call' => $call,
            'room_name' => $roomName,
            'livekit_token' => $livekitToken,
            'livekit_host' => $this->getLivekitHost(),
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

        $call->load(['caller:id,name,username,avatar', 'recipient:id,name,username,avatar']);

        broadcast(new CallAccepted($call))->toOthers();

        $livekitToken = null;
        $service = $this->resolveLivekitService();
        if ($service) {
            try {
                $livekitToken = $service->generateToken(
                    identity: 'user_' . $request->user()->id,
                    roomName: $call->room_name,
                    metadata: json_encode([
                        'user_id' => $request->user()->id,
                        'name' => $request->user()->name,
                        'call_id' => $call->id,
                        'type' => $call->type,
                    ]),
                    canPublish: true,
                    canSubscribe: true,
                    name: $request->user()->name,
                );
            } catch (\Throwable $e) {
                Log::warning('[CallController] LiveKit token generation failed: ' . $e->getMessage());
            }
        }

        return response()->json([
            'call' => $call,
            'room_name' => $call->room_name,
            'livekit_token' => $livekitToken,
            'livekit_host' => $this->getLivekitHost(),
        ]);
    }

    /**
     * Get or refresh a LiveKit token for the authenticated participant of a call.
     */
    public function token(Request $request, int $id): JsonResponse
    {
        $call = Call::findOrFail($id);
        $user = $request->user();

        if ($call->recipient_id !== $user->id && $call->caller_id !== $user->id) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        if (in_array($call->status, ['ended', 'declined'])) {
            return response()->json(['message' => 'Call has already ended.'], 400);
        }

        $service = $this->resolveLivekitService();
        $token = null;
        if ($service) {
            try {
                $token = $service->generateToken(
                    identity: 'user_' . $user->id,
                    roomName: $call->room_name,
                    metadata: json_encode([
                        'user_id' => $user->id,
                        'name' => $user->name,
                        'call_id' => $call->id,
                        'type' => $call->type,
                    ]),
                    canPublish: true,
                    canSubscribe: true,
                    name: $user->name,
                );
            } catch (\Throwable $e) {
                Log::warning('[CallController] LiveKit token generation failed: ' . $e->getMessage());
            }
        }

        return response()->json([
            'call' => $call,
            'room_name' => $call->room_name,
            'livekit_token' => $token,
            'livekit_host' => $this->getLivekitHost(),
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
