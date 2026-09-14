<?php

namespace App\Http\Controllers;

use App\Events\CallAccepted;
use App\Events\CallDeclined;
use App\Events\CallEnded;
use App\Events\CallIncoming;
use App\Events\MessageSent;
use App\Models\Call;
use App\Models\Conversation;
use App\Models\ConversationParticipant;
use App\Models\Message;
use App\Models\User;
use App\Models\UserBlock;
use App\Services\LiveKitService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
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

        $conversationId = $validated['conversation_id'] ?? null;
        if (! $conversationId) {
            $existingConv = Conversation::where('type', 'direct')
                ->whereHas('participants', fn ($q) => $q->where('user_id', $callerId))
                ->whereHas('participants', fn ($q) => $q->where('user_id', $recipientId))
                ->first();
            $conversationId = $existingConv?->id;
        }

        $call = Call::create([
            'caller_id' => $callerId,
            'recipient_id' => $recipientId,
            'conversation_id' => $conversationId,
            'type' => $callType,
            'status' => 'ringing',
            'room_name' => $roomName,
        ]);

        $call->load(['caller:id,name,username,avatar', 'recipient:id,name,username,avatar']);

        // Broadcast real-time incoming call event to recipient
        broadcast(new CallIncoming($call));

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

        broadcast(new CallAccepted($call));

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

        broadcast(new CallDeclined($call));

        // Save missed/declined call in conversation chat history
        $this->logCallMessage($call, 'declined', 0);

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
        if ($request->filled('duration') || $request->filled('duration_seconds')) {
            $duration = (int) ($request->input('duration') ?? $request->input('duration_seconds'));
        } elseif ($call->started_at) {
            $duration = max(0, (int) abs(now()->diffInSeconds($call->started_at)));
        }

        $wasConnected = ($call->status === 'accepted' || $call->started_at !== null);
        $status = $wasConnected ? 'ended' : 'missed';

        $call->update([
            'status' => 'ended',
            'ended_at' => now(),
            'duration_seconds' => $duration,
        ]);

        broadcast(new CallEnded($call));

        // Save call summary in conversation chat history
        $this->logCallMessage($call, $status, $duration);

        return response()->json([
            'call' => $call,
            'message' => 'Call ended.',
        ]);
    }

    /**
     * Resolve or find the direct conversation for a call.
     */
    private function resolveConversationForCall(Call $call): ?Conversation
    {
        if ($call->conversation_id) {
            return Conversation::find($call->conversation_id);
        }

        $existing = Conversation::where('type', 'direct')
            ->whereHas('participants', fn ($q) => $q->where('user_id', $call->caller_id))
            ->whereHas('participants', fn ($q) => $q->where('user_id', $call->recipient_id))
            ->first();

        if (! $existing) {
            $existing = DB::transaction(function () use ($call) {
                $conv = Conversation::create(['type' => 'direct']);
                ConversationParticipant::create(['conversation_id' => $conv->id, 'user_id' => $call->caller_id, 'last_read_at' => now()]);
                ConversationParticipant::create(['conversation_id' => $conv->id, 'user_id' => $call->recipient_id]);
                return $conv;
            });
        }

        if ($existing && ! $call->conversation_id) {
            $call->update(['conversation_id' => $existing->id]);
        }

        return $existing;
    }

    /**
     * Store a call summary message in the conversation thread and broadcast to participants.
     */
    private function logCallMessage(Call $call, string $status, int $durationSeconds = 0): ?Message
    {
        try {
            $conversation = $this->resolveConversationForCall($call);
            if (! $conversation) {
                return null;
            }

            $payload = [
                'call_id' => $call->id,
                'call_type' => $call->type ?? 'audio',
                'status' => $status, // 'ended', 'missed', 'declined'
                'duration' => $durationSeconds,
            ];

            $message = Message::create([
                'conversation_id' => $conversation->id,
                'user_id' => $call->caller_id,
                'content' => json_encode($payload),
                'type' => 'call',
                'status' => Message::STATUS_SENT,
            ]);

            $conversation->touch();

            $loadedMessage = $message->load(['user:id,name,username,avatar']);
            event(new MessageSent($loadedMessage));

            return $loadedMessage;
        } catch (\Throwable $e) {
            Log::warning('[CallController] Failed to log call message: ' . $e->getMessage());
            return null;
        }
    }

    /**
     * Check if the authenticated user has any active incoming (ringing) call.
     */
    public function activeIncoming(Request $request): JsonResponse
    {
        $userId = $request->user()->id;

        $call = Call::with(['caller:id,name,username,avatar'])
            ->where('recipient_id', $userId)
            ->where('status', 'ringing')
            ->where('created_at', '>=', now()->subSeconds(75))
            ->latest()
            ->first();

        if (! $call) {
            return response()->json(['call' => null]);
        }

        $caller = $call->caller;

        return response()->json([
            'call' => $call,
            'id' => $call->id,
            'caller_id' => $call->caller_id,
            'caller' => $caller ? [
                'id' => $caller->id,
                'name' => $caller->name,
                'username' => $caller->username,
                'avatar' => $caller->avatar,
                'avatar_url' => $caller->avatar_url ?? $caller->avatar,
            ] : null,
            'type' => $call->type,
            'room_name' => $call->room_name,
            'livekit_host' => $this->getLivekitHost(),
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

        $livekitToken = null;
        if ($call->status === 'accepted' || $call->status === 'ringing') {
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
                    Log::warning('[CallController] show LiveKit token generation failed: ' . $e->getMessage());
                }
            }
        }

        return response()->json([
            'call' => $call,
            'status' => $call->status,
            'room_name' => $call->room_name,
            'livekit_token' => $livekitToken,
            'livekit_host' => $this->getLivekitHost(),
        ]);
    }
}

