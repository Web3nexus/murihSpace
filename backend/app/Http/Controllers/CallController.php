<?php

namespace App\Http\Controllers;

use App\Events\CallAccepted;
use App\Events\CallDeclined;
use App\Events\CallEnded;
use App\Events\CallIncoming;
use App\Events\CallParticipantInvited;
use App\Events\CallParticipantJoined;
use App\Events\CallParticipantLeft;
use App\Events\CallRinging;
use App\Events\MessageSent;
use App\Models\Call;
use App\Models\CallParticipant;
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
            Log::error('[CallController] Failed to resolve LiveKitService: ' . $e->getMessage());
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

        $recipient = User::find($recipientId);
        $isOnline = $recipient && $recipient->last_seen_at && $recipient->last_seen_at->greaterThanOrEqualTo(now()->subMinutes(5));

        $call = Call::create([
            'caller_id' => $callerId,
            'recipient_id' => $recipientId,
            'conversation_id' => $conversationId,
            'type' => $callType,
            'status' => 'connecting',
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
                Log::error('[CallController] LiveKit token generation FAILED for call ' . ($call->id ?? 'unknown') . ' — check LIVEKIT_API_KEY, LIVEKIT_API_SECRET, LIVEKIT_HOST in .env. Error: ' . $e->getMessage());
            }
        }

        return response()->json([
            'call' => $call,
            'room_name' => $roomName,
            'livekit_token' => $livekitToken,
            'livekit_host' => $this->getLivekitHost(),
            'is_recipient_online' => (bool) $isOnline,
        ], 201);
    }

    /**
     * Mark call as ringing on recipient device (acknowledgment of incoming signal).
     */
    public function ringing(Request $request, int $id): JsonResponse
    {
        $call = Call::findOrFail($id);

        if ((int) $call->recipient_id !== (int) $request->user()->id && (int) $call->caller_id !== (int) $request->user()->id) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        if ($call->status === 'connecting') {
            $call->update(['status' => 'ringing']);
            broadcast(new CallRinging($call));
        }

        return response()->json([
            'call' => $call,
            'status' => $call->status,
            'message' => 'Call is ringing.',
        ]);
    }

    /**
     * Invite / add another user to an ongoing call session.
     */
    public function invite(Request $request, int $id): JsonResponse
    {
        $call = Call::with(['caller', 'recipient', 'participants.user'])->findOrFail($id);

        if (in_array($call->status, ['ended', 'declined'])) {
            return response()->json(['message' => 'Cannot add participants to an ended call.'], 400);
        }

        $allParticipantIds = $call->allParticipantUserIds();
        if (! in_array($request->user()->id, $allParticipantIds)) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        $validated = $request->validate([
            'user_id' => ['required', 'integer', 'exists:users,id'],
        ]);

        $invitedUserId = (int) $validated['user_id'];

        if ($invitedUserId === $request->user()->id) {
            return response()->json(['message' => 'You cannot invite yourself.'], 422);
        }

        if (in_array($invitedUserId, $allParticipantIds)) {
            return response()->json(['message' => 'User is already part of this call.'], 422);
        }

        // Check if either party blocked the other
        $isBlocked = UserBlock::where(function ($q) use ($request, $invitedUserId) {
            $q->where('user_id', $request->user()->id)->where('blocked_id', $invitedUserId);
        })->orWhere(function ($q) use ($request, $invitedUserId) {
            $q->where('user_id', $invitedUserId)->where('blocked_id', $request->user()->id);
        })->exists();

        if ($isBlocked) {
            return response()->json(['message' => 'Cannot invite this user.'], 403);
        }

        $participant = CallParticipant::updateOrCreate(
            ['call_id' => $call->id, 'user_id' => $invitedUserId],
            [
                'invited_by_id' => $request->user()->id,
                'status' => 'ringing',
                'joined_at' => null,
                'left_at' => null,
            ]
        );

        $participant->load(['user:id,name,username,avatar', 'invitedBy:id,name,username,avatar']);

        // 1. Notify the invited user with incoming call alert & LiveKit credentials
        broadcast(new CallIncoming($call, $invitedUserId));

        // 2. Notify other call participants that a new participant was invited
        broadcast(new CallParticipantInvited($call, $participant));

        return response()->json([
            'message' => 'Participant invited successfully.',
            'participant' => $participant,
            'call' => $call,
        ], 201);
    }

    /**
     * Accept an incoming call.
     */
    public function accept(Request $request, int $id): JsonResponse
    {
        $call = Call::findOrFail($id);
        $userId = (int) $request->user()->id;

        $isPrimaryRecipient = (int) $call->recipient_id === $userId;
        $participant = CallParticipant::where('call_id', $call->id)
            ->where('user_id', $userId)
            ->first();

        if (! $isPrimaryRecipient && ! $participant) {
            return response()->json(['message' => 'Unauthorized to accept this call.'], 403);
        }

        if (in_array($call->status, ['ended', 'declined'])) {
            return response()->json(['message' => 'Call is no longer active.', 'status' => $call->status], 400);
        }

        if ($participant) {
            $participant->update([
                'status' => 'accepted',
                'joined_at' => now(),
            ]);
            $participant->load(['user:id,name,username,avatar']);
            try {
                broadcast(new CallParticipantJoined($call, $participant));
            } catch (\Throwable $e) {
                Log::warning('[CallController] broadcast CallParticipantJoined failed: ' . $e->getMessage());
            }
        }

        if ($call->status !== 'accepted') {
            $call->update([
                'status' => 'accepted',
                'started_at' => now(),
            ]);
            $call->load(['caller:id,name,username,avatar', 'recipient:id,name,username,avatar']);
            try {
                broadcast(new CallAccepted($call));
            } catch (\Throwable $e) {
                Log::warning('[CallController] broadcast CallAccepted failed: ' . $e->getMessage());
            }
        }

        $livekitToken = null;
        $service = $this->resolveLivekitService();
        if ($service) {
            try {
                $livekitToken = $service->generateToken(
                    identity: 'user_' . $userId,
                    roomName: $call->room_name,
                    metadata: json_encode([
                        'user_id' => $userId,
                        'name' => $request->user()->name,
                        'call_id' => $call->id,
                        'type' => $call->type,
                    ]),
                    canPublish: true,
                    canSubscribe: true,
                    name: $request->user()->name,
                );
            } catch (\Throwable $e) {
                Log::error('[CallController] LiveKit token generation FAILED for call ' . ($call->id ?? 'unknown') . ' — check LIVEKIT_API_KEY, LIVEKIT_API_SECRET, LIVEKIT_HOST in .env. Error: ' . $e->getMessage());
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

        if (! in_array($user->id, $call->allParticipantUserIds())) {
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
                Log::error('[CallController] LiveKit token generation FAILED for call ' . ($call->id ?? 'unknown') . ' — check LIVEKIT_API_KEY, LIVEKIT_API_SECRET, LIVEKIT_HOST in .env. Error: ' . $e->getMessage());
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
        $userId = $request->user()->id;

        $participant = CallParticipant::where('call_id', $call->id)
            ->where('user_id', $userId)
            ->first();

        if ($participant) {
            $participant->update([
                'status' => 'declined',
                'left_at' => now(),
            ]);
            broadcast(new CallParticipantLeft($call, $participant, 'declined'));
            return response()->json([
                'call' => $call,
                'message' => 'Call invitation declined.',
            ]);
        }

        if ((int) $call->recipient_id !== $userId && (int) $call->caller_id !== $userId) {
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
        $userId = (int) $request->user()->id;

        if (! in_array($userId, $call->allParticipantUserIds())) {
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

        $call = Call::with(['caller:id,name,username,avatar', 'recipient:id,name,username,avatar'])
            ->where(function ($q) use ($userId) {
                $q->where(function ($sub) use ($userId) {
                    $sub->where('recipient_id', $userId)
                        ->whereIn('status', ['connecting', 'ringing'])
                        ->where('created_at', '>=', now()->subSeconds(45));
                })->orWhereHas('participants', function ($sub) use ($userId) {
                    $sub->where('user_id', $userId)
                        ->where('status', 'ringing')
                        ->where('updated_at', '>=', now()->subSeconds(45));
                });
            })
            ->whereNotIn('status', ['ended', 'declined'])
            ->latest()
            ->first();

        if (! $call) {
            return response()->json(['call' => null]);
        }

        $caller = $call->caller;

        $livekitToken = null;
        $service = $this->resolveLivekitService();
        if ($service) {
            try {
                $livekitToken = $service->generateToken(
                    identity: 'user_' . $userId,
                    roomName: $call->room_name,
                    metadata: json_encode([
                        'user_id' => $userId,
                        'name' => $request->user()->name,
                        'call_id' => $call->id,
                        'type' => $call->type,
                    ]),
                    canPublish: true,
                    canSubscribe: true,
                    name: $request->user()->name,
                );
            } catch (\Throwable $e) {
                Log::error('[CallController] LiveKit token generation FAILED for call ' . ($call->id ?? 'unknown') . ' — check LIVEKIT_API_KEY, LIVEKIT_API_SECRET, LIVEKIT_HOST in .env. Error: ' . $e->getMessage());
            }
        }

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
            'livekit_token' => $livekitToken,
        ]);
    }

    /**
     * Get details of a call.
     */
    public function show(Request $request, int $id): JsonResponse
    {
        $call = Call::with([
            'caller:id,name,username,avatar',
            'recipient:id,name,username,avatar',
            'participants.user:id,name,username,avatar',
            'participants.invitedBy:id,name,username',
        ])->findOrFail($id);

        if (! in_array($request->user()->id, $call->allParticipantUserIds())) {
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
                    Log::error('[CallController] LiveKit token generation FAILED for call ' . ($call->id ?? 'unknown') . ' — check LIVEKIT_API_KEY, LIVEKIT_API_SECRET, LIVEKIT_HOST in .env. Error: ' . $e->getMessage());
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

    /**
     * Generate a LiveKit token for a community/group conversation call.
     * All participants of the conversation join the same LiveKit room.
     * Room name is deterministically derived from the conversation ID.
     */
    public function conversationCallToken(Request $request, int $id): JsonResponse
    {
        $user = $request->user();

        // Verify the user is a participant in this conversation
        $isParticipant = ConversationParticipant::where('conversation_id', $id)
            ->where('user_id', $user->id)
            ->exists();

        $conversation = Conversation::find($id);

        if (!$conversation || !$isParticipant) {
            return response()->json(['message' => 'Conversation not found or access denied.'], 403);
        }

        $roomName = 'conv_call_' . $id;
        $livekitToken = null;
        $service = $this->resolveLivekitService();

        if ($service) {
            try {
                $livekitToken = $service->generateToken(
                    identity: 'user_' . $user->id,
                    roomName: $roomName,
                    metadata: json_encode([
                        'user_id' => $user->id,
                        'name' => $user->name,
                        'conversation_id' => $id,
                    ]),
                    canPublish: true,
                    canSubscribe: true,
                    name: $user->name,
                );
            } catch (\Throwable $e) {
                Log::error('[CallController] conversationCallToken FAILED for conversation ' . $id . ' — check LIVEKIT_API_KEY, LIVEKIT_API_SECRET, LIVEKIT_HOST in .env. Error: ' . $e->getMessage());
                return response()->json([
                    'message' => 'Call service is not available. Please contact support.',
                    'livekit_token' => null,
                    'livekit_host' => null,
                    'room' => null,
                ], 503);
            }
        } else {
            Log::error('[CallController] conversationCallToken: LiveKit service unavailable for conversation ' . $id . ' — LIVEKIT_API_KEY/LIVEKIT_API_SECRET not set in .env');
            return response()->json([
                'message' => 'Call service is not configured. Please contact support.',
                'livekit_token' => null,
                'livekit_host' => null,
                'room' => null,
            ], 503);
        }

        return response()->json([
            'token' => $livekitToken,
            'livekit_token' => $livekitToken,
            'host' => $this->getLivekitHost(),
            'livekit_host' => $this->getLivekitHost(),
            'room' => $roomName,
        ]);
    }
}
