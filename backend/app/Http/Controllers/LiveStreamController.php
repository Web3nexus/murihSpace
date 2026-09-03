<?php

namespace App\Http\Controllers;

use App\Models\Gift;
use App\Models\LiveStream;
use App\Models\LiveStreamLike;
use App\Models\LiveStreamMessage;
use App\Models\LiveStreamParticipant;
use App\Models\Wallet;
use App\Services\LiveKitService;
use App\Services\NotificationService;
use App\Services\Wallet\FeeCalculatorService;
use App\Services\Wallet\LedgerService;
use App\Services\Wallet\WalletService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class LiveStreamController extends Controller
{
    public function __construct(
        private readonly LiveKitService $liveKitService,
        private readonly NotificationService $notifications,
        private readonly WalletService $walletService,
        private readonly LedgerService $ledgerService,
        private readonly FeeCalculatorService $feeCalculator,
    ) {}

    /**
     * Discover active live streams.
     */
    public function index(Request $request): JsonResponse
    {
        $streams = LiveStream::with(['host:id,name,username,avatar,avatar_url,role', 'community:id,name,slug,avatar,avatar_url'])
            ->where('status', 'live')
            ->orderBy('viewers_count', 'desc')
            ->orderBy('created_at', 'desc')
            ->paginate($request->integer('per_page', 20));

        return response()->json($streams);
    }

    /**
     * Start a new live broadcast (Host only).
     */
    public function start(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:1000'],
            'stream_mode' => ['nullable', 'string', 'in:video,audio,meeting'],
            'community_id' => ['nullable', 'exists:communities,id'],
            'background_sound' => ['nullable', 'string', 'max:100'],
            'pinned_product_id' => ['nullable', 'integer'],
        ]);

        $user = $request->user();

        // End any active streams previously hosted by this user
        LiveStream::where('user_id', $user->id)
            ->where('status', 'live')
            ->update([
                'status' => 'ended',
                'ended_at' => now(),
            ]);

        $roomName = 'live_stream_' . Str::uuid();

        $stream = LiveStream::create([
            'user_id' => $user->id,
            'community_id' => $validated['community_id'] ?? null,
            'title' => $validated['title'],
            'description' => $validated['description'] ?? null,
            'stream_mode' => $validated['stream_mode'] ?? 'video',
            'status' => 'live',
            'livekit_room' => $roomName,
            'viewers_count' => 1,
            'peak_viewers' => 1,
            'likes_count' => 0,
            'total_coins_earned' => 0,
            'background_sound' => $validated['background_sound'] ?? null,
            'pinned_product_id' => $validated['pinned_product_id'] ?? null,
            'started_at' => now(),
        ]);

        // Add host as active participant
        LiveStreamParticipant::create([
            'live_stream_id' => $stream->id,
            'user_id' => $user->id,
            'role' => 'host',
            'is_active' => true,
            'joined_at' => now(),
        ]);

        // Generate Host LiveKit publisher token (canPublish: true)
        $token = $this->liveKitService->generateToken(
            identity: 'user_' . $user->id,
            roomName: $roomName,
            metadata: json_encode([
                'user_id' => $user->id,
                'name' => $user->name,
                'username' => $user->username,
                'avatar_url' => $user->avatar_url ?? $user->avatar,
                'role' => 'host',
            ]),
            canPublish: true,
            canSubscribe: true,
            name: $user->name,
        );

        return response()->json([
            'message' => 'Live stream started successfully.',
            'stream' => $stream->load(['host:id,name,username,avatar,avatar_url,role', 'community:id,name,slug,avatar,avatar_url']),
            'livekit' => [
                'token' => $token,
                'room' => $roomName,
                'host' => config('livekit.host', 'http://localhost:7880'),
                'is_publisher' => true,
            ],
        ], 201);
    }

    /**
     * Get live stream details and live metrics.
     */
    public function show(int $id): JsonResponse
    {
        $stream = LiveStream::with([
            'host:id,name,username,avatar,avatar_url,role',
            'community:id,name,slug,avatar,avatar_url',
        ])->findOrFail($id);

        $activeViewers = $stream->activeParticipants()
            ->with('user:id,name,username,avatar,avatar_url')
            ->limit(30)
            ->get();

        return response()->json([
            'stream' => $stream,
            'active_viewers' => $activeViewers,
        ]);
    }

    /**
     * Join an active live broadcast (Viewer).
     */
    public function join(Request $request, int $id): JsonResponse
    {
        $stream = LiveStream::findOrFail($id);

        if ($stream->status !== 'live') {
            return response()->json([
                'message' => 'This live stream has ended.',
                'code' => 'STREAM_ENDED',
            ], 410);
        }

        $user = $request->user();
        $isHost = $user->id === $stream->user_id;

        // Upsert participant record
        LiveStreamParticipant::updateOrCreate(
            [
                'live_stream_id' => $stream->id,
                'user_id' => $user->id,
            ],
            [
                'role' => $isHost ? 'host' : 'viewer',
                'is_active' => true,
                'joined_at' => now(),
                'left_at' => null,
            ]
        );

        // Recalculate real active viewer count
        $activeCount = $stream->activeParticipants()->count();
        $stream->update([
            'viewers_count' => $activeCount,
            'peak_viewers' => max($stream->peak_viewers, $activeCount),
        ]);

        // Generate LiveKit token
        $token = $this->liveKitService->generateToken(
            identity: 'user_' . $user->id,
            roomName: $stream->livekit_room,
            metadata: json_encode([
                'user_id' => $user->id,
                'name' => $user->name,
                'username' => $user->username,
                'avatar_url' => $user->avatar_url ?? $user->avatar,
                'role' => $isHost ? 'host' : 'viewer',
            ]),
            canPublish: $isHost,
            canSubscribe: true,
            name: $user->name,
        );

        return response()->json([
            'message' => 'Joined live stream successfully.',
            'stream' => $stream->fresh(['host:id,name,username,avatar,avatar_url,role', 'community:id,name,slug,avatar,avatar_url']),
            'livekit' => [
                'token' => $token,
                'room' => $stream->livekit_room,
                'host' => config('livekit.host', 'http://localhost:7880'),
                'is_publisher' => $isHost,
            ],
        ]);
    }

    /**
     * Leave a live broadcast.
     */
    public function leave(Request $request, int $id): JsonResponse
    {
        $stream = LiveStream::findOrFail($id);
        $user = $request->user();

        LiveStreamParticipant::where('live_stream_id', $stream->id)
            ->where('user_id', $user->id)
            ->update([
                'is_active' => false,
                'left_at' => now(),
            ]);

        $activeCount = $stream->activeParticipants()->count();
        $stream->update(['viewers_count' => $activeCount]);

        return response()->json([
            'message' => 'Left live stream.',
            'viewers_count' => $activeCount,
        ]);
    }

    /**
     * Send authenticated likes to a live broadcast.
     */
    public function like(Request $request, int $id): JsonResponse
    {
        $stream = LiveStream::findOrFail($id);

        if ($stream->status !== 'live') {
            return response()->json(['message' => 'Stream is not active.'], 422);
        }

        $validated = $request->validate([
            'count' => ['nullable', 'integer', 'min:1', 'max:20'],
        ]);

        $count = $validated['count'] ?? 1;
        $user = $request->user();

        LiveStreamLike::create([
            'live_stream_id' => $stream->id,
            'user_id' => $user->id,
            'count' => $count,
        ]);

        $stream->increment('likes_count', $count);

        return response()->json([
            'message' => 'Like recorded.',
            'likes_count' => $stream->fresh()->likes_count,
        ]);
    }

    /**
     * Send a real-time live chat message.
     */
    public function sendMessage(Request $request, int $id): JsonResponse
    {
        $stream = LiveStream::findOrFail($id);

        if ($stream->status !== 'live') {
            return response()->json(['message' => 'Stream is not active.'], 422);
        }

        $validated = $request->validate([
            'message' => ['required', 'string', 'max:500'],
        ]);

        $user = $request->user();

        $msg = LiveStreamMessage::create([
            'live_stream_id' => $stream->id,
            'user_id' => $user->id,
            'message' => $validated['message'],
        ]);

        return response()->json([
            'message' => 'Message sent.',
            'data' => $msg->load('user:id,name,username,avatar,avatar_url,role'),
        ], 201);
    }

    /**
     * List recent live chat messages.
     */
    public function getMessages(int $id): JsonResponse
    {
        $messages = LiveStreamMessage::with('user:id,name,username,avatar,avatar_url,role')
            ->where('live_stream_id', $id)
            ->latest()
            ->limit(50)
            ->get()
            ->reverse()
            ->values();

        return response()->json(['data' => $messages]);
    }

    /**
     * Send a coin gift to the host with atomic wallet deduction and ledger logging.
     */
    public function sendGift(Request $request, int $id): JsonResponse
    {
        $stream = LiveStream::with('host')->findOrFail($id);

        if ($stream->status !== 'live') {
            return response()->json(['message' => 'Stream has ended.'], 422);
        }

        $user = $request->user();
        $host = $stream->host;

        if ($user->id === $host->id) {
            return response()->json([
                'message' => 'Hosts cannot send gifts to their own stream.',
                'code' => 'SELF_GIFT_PROHIBITED',
            ], 422);
        }

        $validated = $request->validate([
            'gift_id' => ['required', 'exists:gifts,id'],
            'is_anonymous' => ['nullable', 'boolean'],
            'message' => ['nullable', 'string', 'max:255'],
        ]);

        $gift = Gift::findOrFail($validated['gift_id']);
        $senderWallet = $this->walletService->getOrCreateWallet($user, 'system');
        $coinPrice = (int) $gift->coin_price;

        if ($senderWallet->available < $coinPrice) {
            return response()->json([
                'message' => 'Insufficient coin balance. Please top up your wallet.',
                'code' => 'INSUFFICIENT_COINS',
                'current_balance' => $senderWallet->available,
                'required_coins' => $coinPrice,
            ], 402);
        }

        // Execute atomic deduction and host earnings credit
        $tx = DB::transaction(function () use ($user, $host, $gift, $stream, $senderWallet, $coinPrice, $validated) {
            // Deduct from sender
            $senderWallet->decrement('available', $coinPrice);

            // Credit host creator wallet
            $creatorWallet = $this->walletService->getOrCreateWallet($host, 'creator');
            $creatorWallet->increment('available', $gift->creator_earns);

            // Update live stream total coins earned
            $stream->increment('total_coins_earned', $coinPrice);

            // Record gift transaction
            return \App\Models\GiftTransaction::create([
                'sender_id' => $user->id,
                'recipient_id' => $host->id,
                'gift_id' => $gift->id,
                'giftable_type' => LiveStream::class,
                'giftable_id' => $stream->id,
                'coin_price' => $coinPrice,
                'creator_earns' => $gift->creator_earns,
                'platform_commission' => $gift->platform_commission,
                'status' => 'completed',
                'is_anonymous' => $validated['is_anonymous'] ?? false,
                'sender_display_name' => ($validated['is_anonymous'] ?? false) ? 'Anonymous Fan' : $user->name,
                'message' => $validated['message'] ?? null,
                'idempotency_key' => 'LIVE-GIFT-' . Str::uuid(),
            ]);
        });

        return response()->json([
            'message' => 'Gift sent successfully!',
            'transaction' => $tx,
            'gift' => $gift,
            'sender_balance' => $senderWallet->fresh()->available,
            'stream_total_coins' => $stream->fresh()->total_coins_earned,
        ]);
    }

    /**
     * End a live broadcast (Host only).
     */
    public function end(Request $request, int $id): JsonResponse
    {
        $stream = LiveStream::findOrFail($id);
        $user = $request->user();

        if ($stream->user_id !== $user->id && $user->role !== 'admin') {
            return response()->json(['message' => 'Only the broadcast host can end this live stream.'], 403);
        }

        if ($stream->status === 'ended') {
            return response()->json(['message' => 'Stream already ended.', 'stream' => $stream]);
        }

        $stream->update([
            'status' => 'ended',
            'ended_at' => now(),
            'viewers_count' => 0,
        ]);

        // Mark all active participants as inactive
        LiveStreamParticipant::where('live_stream_id', $stream->id)
            ->where('is_active', true)
            ->update([
                'is_active' => false,
                'left_at' => now(),
            ]);

        return response()->json([
            'message' => 'Live stream ended successfully.',
            'stream' => $stream->fresh(),
            'summary' => [
                'total_likes' => $stream->likes_count,
                'peak_viewers' => $stream->peak_viewers,
                'total_coins_earned' => $stream->total_coins_earned,
                'duration_seconds' => $stream->started_at ? $stream->ended_at->diffInSeconds($stream->started_at) : 0,
            ],
        ]);
    }
}
