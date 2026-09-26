<?php

namespace App\Http\Controllers;

use App\Models\DigitalProduct;
use App\Models\Escrow;
use App\Models\FulfilmentOrder;
use App\Models\FulfilmentOrderItem;
use App\Models\Gift;
use App\Models\GiftTransaction;
use App\Models\LiveStream;
use App\Models\LiveStreamLike;
use App\Models\LiveStreamMessage;
use App\Models\LiveStreamParticipant;
use App\Models\Order;
use App\Models\PhysicalProduct;
use App\Models\Storefront;
use App\Models\User;
use App\Models\Wallet;
use App\Services\Accounting\AccountingStreamService;
use App\Services\LiveKitService;
use App\Services\LiveStreamAttributionService;
use App\Services\NotificationService;
use App\Services\Tax\TaxCalculationService;
use App\Services\Wallet\FeeCalculatorService;
use App\Services\Wallet\LedgerService;
use App\Services\Wallet\WalletService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class LiveStreamController extends Controller
{
    public const DIGITAL_FEE_RATE = 0.10;

    public const PHYSICAL_FEE_RATE = 0.05;

    public function __construct(
        private readonly LiveKitService $liveKitService,
        private readonly LiveStreamAttributionService $liveAttributions,
        private readonly NotificationService $notifications,
        private readonly WalletService $walletService,
        private readonly LedgerService $ledgerService,
        private readonly FeeCalculatorService $feeCalculator,
        private readonly TaxCalculationService $taxService,
        private readonly AccountingStreamService $accountingService,
    ) {}

    /**
     * Discover active live streams.
     */
    public function index(Request $request): JsonResponse
    {
        $streams = LiveStream::with(['host:id,name,username,avatar,role', 'community:id,name,slug,logo_url,cover_url'])
            ->where('status', 'live')
            ->orderBy('viewers_count', 'desc')
            ->orderBy('created_at', 'desc')
            ->paginate($request->integer('per_page', 20));

        return response()->json($streams);
    }

    public function resolve(Request $request, string $token): JsonResponse
    {
        $stream = $this->findLiveStreamByToken($token);
        if (! $stream) {
            return response()->json(['message' => 'Live stream not found.'], 404);
        }

        $stream->loadMissing([
            'host:id,name,username,avatar,role',
            'community:id,name,slug,logo_url,cover_url',
        ]);

        $attribution = $this->liveAttributions->record($request, $stream, 'click');
        $legacy = $stream->tracking_id !== $token;

        $livekit = null;
        if ($stream->status === 'live') {
            $user = $request->user('sanctum') ?? $request->user();
            $guestId = $user ? 'user_'.$user->id : 'guest_'.Str::random(12);
            $guestName = $user ? $user->name : 'Viewer';
            try {
                $livekitToken = $this->liveKitService->generateToken(
                    identity: $guestId,
                    roomName: $stream->livekit_room,
                    metadata: json_encode([
                        'user_id' => $user?->id,
                        'name' => $guestName,
                        'role' => 'viewer',
                    ]),
                    canPublish: false,
                    canSubscribe: true,
                    name: $guestName,
                );
                $livekit = [
                    'token' => $livekitToken,
                    'room' => $stream->livekit_room,
                    'host' => $this->getLivekitHost(),
                    'is_publisher' => false,
                ];
            } catch (\Throwable $e) {
                \Log::warning('[LiveStreamController] Public LiveKit token generation failed: '.$e->getMessage());
            }
        }

        return response()->json([
            'stream' => $this->publicStreamPayload($stream),
            'canonical_url' => $this->liveAttributions->canonicalUrl($stream),
            'legacy' => $legacy,
            'livekit' => $livekit,
            'attribution' => [
                'session_id' => $attribution->session_id,
                'event' => 'click',
            ],
        ]);
    }

    public function recordAttribution(Request $request, int $id): JsonResponse
    {
        $validated = $request->validate([
            'event' => ['required', 'string', 'in:heartbeat'],
        ]);

        $stream = LiveStream::findOrFail($id);
        if ($stream->status !== 'live') {
            return response()->json(['message' => 'This live stream has ended.'], 410);
        }

        $isActiveParticipant = LiveStreamParticipant::query()
            ->where('live_stream_id', $stream->id)
            ->where('user_id', $request->user()->id)
            ->where('is_active', true)
            ->exists();

        if (! $isActiveParticipant) {
            return response()->json(['message' => 'Join the live stream before sending attribution heartbeats.'], 403);
        }

        $attribution = $this->liveAttributions->record($request, $stream, $validated['event']);

        return response()->json([
            'message' => 'Live attribution recorded.',
            'attribution' => [
                'session_id' => $attribution->session_id,
                'event' => $validated['event'],
                'recorded_at' => $attribution->last_seen_at,
            ],
        ]);
    }

    public function analytics(Request $request, int $id): JsonResponse
    {
        $stream = LiveStream::findOrFail($id);
        $this->ensureHost($request, $stream);

        $attributions = $stream->attributions();
        $recent = (clone $attributions)
            ->with('user:id,name,username,avatar,role')
            ->latest('last_seen_at')
            ->limit(100)
            ->get()
            ->map(fn ($attribution): array => [
                'session_id' => $attribution->session_id,
                'user_id' => $attribution->user_id,
                'user' => $attribution->user ? [
                    'id' => $attribution->user->id,
                    'name' => $attribution->user->name,
                    'username' => $attribution->user->username,
                    'avatar_url' => $attribution->user->avatar_url ?? $attribution->user->avatar,
                ] : null,
                'source' => $attribution->source,
                'click_count' => $attribution->click_count,
                'join_count' => $attribution->join_count,
                'leave_count' => $attribution->leave_count,
                'first_seen_at' => $attribution->first_seen_at?->toIso8601String(),
                'last_seen_at' => $attribution->last_seen_at?->toIso8601String(),
            ]);

        $bySource = (clone $attributions)
            ->select('source', DB::raw('COUNT(*) as sessions'), DB::raw('SUM(click_count) as clicks'))
            ->groupBy('source')
            ->orderByDesc('sessions')
            ->get();

        return response()->json([
            'stream' => [
                'id' => $stream->id,
                'tracking_id' => $stream->tracking_id,
                'title' => $stream->title,
                'host_user_id' => $stream->user_id,
            ],
            'summary' => [
                'sessions' => (clone $attributions)->count(),
                'unique_accounts' => (clone $attributions)->whereNotNull('user_id')->distinct()->count('user_id'),
                'authenticated_sessions' => (clone $attributions)->whereNotNull('user_id')->count(),
                'clicks' => (int) ((clone $attributions)->sum('click_count') ?? 0),
                'joined_sessions' => (clone $attributions)->where('join_count', '>', 0)->count(),
                'left_sessions' => (clone $attributions)->where('leave_count', '>', 0)->count(),
            ],
            'by_source' => $bySource,
            'recent_sessions' => $recent,
        ]);
    }

    private function findLiveStreamByToken(string $token): ?LiveStream
    {
        $stream = LiveStream::where('tracking_id', $token)->first();
        if ($stream) {
            return $stream;
        }

        if (ctype_digit($token)) {
            return LiveStream::find((int) $token);
        }

        $encoded = strtr(trim($token), '-_', '+/');
        $encoded .= str_repeat('=', (4 - strlen($encoded) % 4) % 4);
        $decoded = base64_decode($encoded, true);
        if ($decoded === false) {
            return null;
        }

        $parts = explode(':', trim($decoded));
        if (! isset($parts[0]) || ! ctype_digit($parts[0])) {
            return null;
        }

        $stream = LiveStream::find((int) $parts[0]);
        if (! $stream) {
            return null;
        }

        if (isset($parts[1]) && $parts[1] !== '' && (! ctype_digit($parts[1]) || (int) $parts[1] !== $stream->user_id)) {
            return null;
        }

        return $stream;
    }

    private function publicStreamPayload(LiveStream $stream): array
    {
        $host = $stream->host;

        return [
            'id' => $stream->id,
            'tracking_id' => $stream->tracking_id,
            'title' => $stream->title,
            'description' => $stream->description,
            'stream_mode' => $stream->stream_mode,
            'status' => $stream->status,
            'viewers_count' => $stream->viewers_count,
            'started_at' => $stream->started_at?->toIso8601String(),
            'host' => $host ? [
                'id' => $host->id,
                'name' => $host->name,
                'username' => $host->username,
                'avatar_url' => $host->avatar_url ?? $host->avatar,
            ] : null,
            'community' => $stream->community ? [
                'id' => $stream->community->id,
                'name' => $stream->community->name,
                'slug' => $stream->community->slug,
            ] : null,
        ];
    }

    private function getLivekitHost(): string
    {
        $defaultHost = app()->environment('production')
            ? 'https://live.murihspace.com'
            : 'https://live-staging.murihspace.com';

        $host = (string) config('livekit.host', $defaultHost);
        if (empty($host) || str_contains($host, 'localhost') || str_contains($host, '127.0.0.1')) {
            $host = $defaultHost;
        }

        return rtrim($host, '/');
    }

    private function ensureHost(Request $request, LiveStream $stream): void
    {
        $user = $request->user();
        if ($stream->user_id !== $user->id && $user->role !== 'admin') {
            abort(403, 'Only the broadcast host can view live attribution.');
        }
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

        // Enforce KYC verification before going live
        if (! in_array($user->kyc_status, ['verified', 'approved'], true)) {
            return response()->json([
                'success' => false,
                'message' => 'Identity verification (KYC) is required before going live. Please verify your identity first.',
                'error' => 'kyc_required',
                'kyc_status' => $user->kyc_status ?? 'unsubmitted',
            ], 403);
        }

        // End any active streams previously hosted by this user
        LiveStream::where('user_id', $user->id)
            ->where('status', 'live')
            ->update([
                'status' => 'ended',
                'ended_at' => now(),
            ]);

        $roomName = 'live_stream_'.Str::uuid();

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

        // Generate Host LiveKit publisher token safely (canPublish: true)
        $token = null;
        try {
            $token = $this->liveKitService->generateToken(
                identity: 'user_'.$user->id,
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
        } catch (\Throwable $e) {
            \Log::warning('[LiveStreamController] Host LiveKit token generation failed: '.$e->getMessage(), [
                'user_id' => $user->id,
                'stream_id' => $stream->id,
            ]);
        }

        return response()->json([
            'message' => 'Live stream started successfully.',
            'stream' => $stream->load(['host:id,name,username,avatar,role', 'community:id,name,slug,logo_url,cover_url']),
            'pinned_product' => $this->pinnedProductPayload($stream),
            'livekit' => [
                'token' => $token,
                'room' => $roomName,
                'host' => $this->getLivekitHost(),
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
            'host:id,name,username,avatar,role',
            'community:id,name,slug,logo_url,cover_url',
        ])->findOrFail($id);

        $activeViewers = $stream->activeParticipants()
            ->with('user:id,name,username,avatar,role')
            ->limit(30)
            ->get();

        return response()->json([
            'stream' => $stream,
            'active_viewers' => $activeViewers,
            'pinned_product' => $this->pinnedProductPayload($stream),
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

        $this->liveAttributions->record($request, $stream, 'join');

        // Generate LiveKit token safely
        $token = null;
        try {
            $token = $this->liveKitService->generateToken(
                identity: 'user_'.$user->id,
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
        } catch (\Throwable $e) {
            \Log::warning('[LiveStreamController] Viewer LiveKit token generation failed: '.$e->getMessage(), [
                'user_id' => $user->id,
                'stream_id' => $stream->id,
            ]);
        }

        return response()->json([
            'message' => 'Joined live stream successfully.',
            'stream' => $stream->fresh(['host:id,name,username,avatar,role', 'community:id,name,slug,logo_url,cover_url']),
            'pinned_product' => $this->pinnedProductPayload($stream),
            'livekit' => [
                'token' => $token,
                'room' => $stream->livekit_room,
                'host' => $this->getLivekitHost(),
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
        $this->liveAttributions->record($request, $stream, 'leave');

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
            'data' => $msg->load('user:id,name,username,avatar,role'),
        ], 201);
    }

    /**
     * List recent live chat messages.
     */
    public function getMessages(int $id): JsonResponse
    {
        $messages = LiveStreamMessage::with('user:id,name,username,avatar,role')
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
            $giftTx = GiftTransaction::create([
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
                'idempotency_key' => 'LIVE-GIFT-'.Str::uuid(),
            ]);

            // Broadcast gift celebration message to live chat
            $displayName = ($validated['is_anonymous'] ?? false) ? 'Someone' : $user->name;
            LiveStreamMessage::create([
                'live_stream_id' => $stream->id,
                'user_id' => $user->id,
                'message' => "🎁 {$displayName} sent {$gift->name}!",
            ]);

            return $giftTx;
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
     * Purchase the pinned product directly inside an active live stream.
     *
     * Funds are processed in-app: digital products are fulfilled instantly
     * (auto-completed mock payment), while physical products create a
     * fulfilment order whose value is held in escrow until delivered.
     */
    public function purchase(Request $request, int $id): JsonResponse
    {
        $stream = LiveStream::with('host')->findOrFail($id);

        if ($stream->status !== 'live') {
            return response()->json([
                'message' => 'This live stream has ended.',
                'code' => 'STREAM_ENDED',
            ], 410);
        }

        $validated = $request->validate([
            'product_id' => ['required', 'integer'],
            'product_type' => ['nullable', 'string', 'in:physical,digital'],
            'quantity' => ['nullable', 'integer', 'min:1', 'max:100'],
            'idempotency_key' => ['required', 'string', 'max:128'],
        ]);

        $buyer = $request->user();

        if ($buyer->id === $stream->user_id) {
            return response()->json([
                'message' => 'Hosts cannot purchase from their own live stream.',
                'code' => 'SELF_PURCHASE_PROHIBITED',
            ], 422);
        }

        // Only the product the host pinned for this stream is purchasable here.
        if (! $stream->pinned_product_id || (int) $stream->pinned_product_id !== (int) $validated['product_id']) {
            return response()->json([
                'message' => 'This product is not pinned for sale on this stream.',
                'code' => 'PRODUCT_NOT_PINNED',
            ], 422);
        }

        $productId = (int) $validated['product_id'];
        $requestedType = $validated['product_type'] ?? null;

        // Physical ids and digital ids live in separate tables, so an explicit
        // product_type from the client disambiguates a numeric id collision.
        $physical = $requestedType === 'digital' ? null : PhysicalProduct::find($productId);
        $digital = $physical ? null : ($requestedType === 'physical' ? null : DigitalProduct::find($productId));

        if (! $physical && ! $digital) {
            return response()->json(['message' => 'Product not found.'], 404);
        }

        if ($physical) {
            return $this->purchasePhysical($stream, $buyer, $physical, $validated);
        }

        return $this->purchaseDigital($stream, $buyer, $digital, $validated);
    }

    private function purchasePhysical(
        LiveStream $stream,
        User $buyer,
        PhysicalProduct $product,
        array $validated
    ): JsonResponse {
        if (! $product->is_active) {
            return response()->json([
                'message' => 'This product is no longer available.',
                'code' => 'PRODUCT_UNAVAILABLE',
            ], 409);
        }

        $quantity = (int) ($validated['quantity'] ?? 1);

        if ($product->track_inventory && $product->stock_quantity < $quantity) {
            return response()->json([
                'message' => 'Insufficient stock for this product.',
                'code' => 'OUT_OF_STOCK',
                'available' => $product->stock_quantity,
            ], 409);
        }

        // Idempotency scoped to the buyer: reuse an existing order for the same key.
        $existing = FulfilmentOrder::where('idempotency_key', $validated['idempotency_key'])
            ->where('buyer_id', $buyer->id)
            ->first();
        if ($existing) {
            return response()->json([
                'message' => 'Existing order returned (idempotent).',
                'product_type' => 'physical',
                'order' => $existing->load(['items.physicalProduct']),
            ]);
        }

        $subtotal = $product->price * $quantity;
        $platformFee = (int) round($subtotal * self::PHYSICAL_FEE_RATE);

        // Destination-based VAT when the buyer's country is known.
        $storefront = Storefront::where('user_id', $product->creator_id)->first();
        $storefrontRate = $storefront ? (float) $storefront->tax_rate : 0.0;
        $taxInfo = $this->taxService->resolveCheckoutTax($subtotal, $buyer->country, $storefrontRate, 'commerce');
        $tax = $taxInfo['tax_amount_cents'];
        $total = $subtotal + $platformFee + $tax;

        $order = DB::transaction(function () use ($buyer, $product, $quantity, $subtotal, $platformFee, $tax, $taxInfo, $total, $validated) {
            $lockedProduct = PhysicalProduct::where('id', $product->id)->lockForUpdate()->first();
            if ($lockedProduct && $lockedProduct->track_inventory && $lockedProduct->stock_quantity < $quantity) {
                abort(409, 'Insufficient stock for this product.');
            }

            $order = FulfilmentOrder::create([
                'buyer_id' => $buyer->id,
                'shipping_address_id' => null,
                'order_number' => $this->generateOrderNumber('FO-'),
                'subtotal' => $subtotal,
                'shipping_cost' => 0,
                'platform_fee' => $platformFee,
                'tax' => $tax,
                'tax_rate' => $taxInfo['tax_rate_percentage'],
                'tax_country_code' => $taxInfo['country_code'],
                'tax_type' => $taxInfo['tax_type'],
                'total' => $total,
                'currency' => $product->currency,
                'status' => 'confirmed',
                'idempotency_key' => $validated['idempotency_key'],
            ]);

            FulfilmentOrderItem::create([
                'fulfilment_order_id' => $order->id,
                'physical_product_id' => $product->id,
                'quantity' => $quantity,
                'unit_price' => $product->price,
                'currency' => $product->currency,
            ]);

            if ($lockedProduct && $lockedProduct->track_inventory) {
                $lockedProduct->decrement('stock_quantity', $quantity);
            }

            // Hold only the seller's share. Tax is collected by the platform
            // and must not be released to the seller on settlement.
            Escrow::create([
                'fulfilment_order_id' => $order->id,
                'buyer_id' => $buyer->id,
                'seller_id' => $product->creator_id,
                'amount' => $subtotal,
                'currency' => $product->currency,
                'status' => 'held',
                'release_window_days' => 7,
            ]);

            return $order;
        });

        $this->accountingService->recordCommerceSale(
            orderNumber: $order->order_number,
            sourceId: $order->id,
            currency: $order->currency,
            grossCents: (int) $order->subtotal,
            taxCents: (int) $order->tax,
            taxRate: (float) $order->tax_rate,
            taxType: $order->tax_type,
            taxName: null,
            countryCode: $order->tax_country_code,
            platformFeeCents: (int) $order->platform_fee,
            metadata: [
                'order_id' => $order->id,
                'buyer_id' => $order->buyer_id,
                'creator_id' => $product->creator_id,
                'product_id' => $product->id,
                'live_stream_id' => $stream->id,
                'fulfilment' => true,
            ],
        );

        return response()->json([
            'message' => 'Purchase successful. Your order is being processed.',
            'product_type' => 'physical',
            'order' => $order->load(['items.physicalProduct']),
        ], 201);
    }

    private function purchaseDigital(
        LiveStream $stream,
        User $buyer,
        DigitalProduct $product,
        array $validated
    ): JsonResponse {
        // Idempotency scoped to the buyer: reuse an already-created order for the same key.
        $existing = Order::where('idempotency_key', $validated['idempotency_key'])
            ->where('buyer_id', $buyer->id)
            ->first();
        if ($existing) {
            return response()->json([
                'message' => 'Existing order returned (idempotent).',
                'product_type' => 'digital',
                'order' => $existing->load(['product', 'creator']),
                'download_url' => $this->digitalDownloadUrl($product),
            ]);
        }

        // Free products are unlocked instantly.
        if ($product->is_free) {
            $order = DB::transaction(function () use ($buyer, $product, $validated) {
                return Order::create([
                    'order_number' => $this->generateOrderNumber('ORD-'),
                    'buyer_id' => $buyer->id,
                    'creator_id' => $product->creator_id,
                    'product_id' => $product->id,
                    'subtotal' => 0.00,
                    'platform_fee' => 0.00,
                    'total' => 0.00,
                    'currency' => $product->currency,
                    'status' => 'completed',
                    'payment_provider' => 'mock',
                    'idempotency_key' => $validated['idempotency_key'],
                    'paid_at' => now(),
                ]);
            });

            $product->increment('download_count');

            return response()->json([
                'message' => 'Free product unlocked.',
                'product_type' => 'digital',
                'order' => $order->load(['product', 'creator']),
                'download_url' => $this->digitalDownloadUrl($product),
            ], 201);
        }

        $pricing = $this->computeLiveDigitalPricing($product, $buyer->country);

        $order = DB::transaction(function () use ($buyer, $product, $pricing, $validated) {
            return Order::create([
                'order_number' => $this->generateOrderNumber('ORD-'),
                'buyer_id' => $buyer->id,
                'creator_id' => $product->creator_id,
                'product_id' => $product->id,
                'subtotal' => $pricing['subtotal'],
                'platform_fee' => $pricing['platform_fee'],
                'tax' => $pricing['tax'],
                'tax_rate' => $pricing['tax_rate'],
                'tax_country_code' => $pricing['tax_country_code'],
                'tax_type' => $pricing['tax_type'],
                'tax_name' => $pricing['tax_name'],
                'total' => $pricing['total'],
                'currency' => $product->currency,
                'status' => 'completed',
                'payment_provider' => 'mock',
                'idempotency_key' => $validated['idempotency_key'],
                'paid_at' => now(),
            ]);
        });

        $product->increment('download_count');

        $this->accountingService->recordCommerceSale(
            orderNumber: $order->order_number,
            sourceId: $order->id,
            currency: $order->currency,
            grossCents: (int) round(((float) $order->subtotal) * 100),
            taxCents: (int) round(((float) $order->tax) * 100),
            taxRate: (float) $order->tax_rate,
            taxType: $order->tax_type,
            taxName: $order->tax_name,
            countryCode: $order->tax_country_code,
            platformFeeCents: (int) round(((float) $order->platform_fee) * 100),
            metadata: [
                'order_id' => $order->id,
                'buyer_id' => $order->buyer_id,
                'creator_id' => $order->creator_id,
                'product_id' => $order->product_id,
                'live_stream_id' => $stream->id,
            ],
        );

        return response()->json([
            'message' => 'Purchase successful!',
            'product_type' => 'digital',
            'order' => $order->fresh()->load(['product', 'creator']),
            'download_url' => $this->digitalDownloadUrl($product),
        ], 201);
    }

    private function computeLiveDigitalPricing(DigitalProduct $product, ?string $buyerCountryCode): array
    {
        $subtotal = round((float) $product->price, 2);
        $subtotalCents = (int) round($subtotal * 100);
        $platformFee = round($subtotal * self::DIGITAL_FEE_RATE, 2);

        $storefront = Storefront::where('user_id', $product->creator_id)->first();
        $storefrontRate = $storefront ? (float) $storefront->tax_rate : 0.0;

        $taxInfo = $this->taxService->resolveCheckoutTax($subtotalCents, $buyerCountryCode, $storefrontRate, 'commerce');
        $tax = round($taxInfo['tax_amount_cents'] / 100, 2);
        $total = round($subtotal + $platformFee + $tax, 2);

        return [
            'subtotal' => $subtotal,
            'platform_fee' => $platformFee,
            'tax' => $tax,
            'tax_rate' => $taxInfo['tax_rate_percentage'],
            'tax_name' => $taxInfo['tax_name'],
            'tax_type' => $taxInfo['tax_type'],
            'tax_country_code' => $taxInfo['country_code'],
            'total' => $total,
            'currency' => $product->currency,
        ];
    }

    /**
     * Resolve the product pinned to a stream into a display-ready payload
     * so hosts and viewers can render the buy card without extra requests.
     */
    private function pinnedProductPayload(LiveStream $stream): ?array
    {
        if (! $stream->pinned_product_id) {
            return null;
        }

        $physical = PhysicalProduct::find($stream->pinned_product_id);
        if ($physical) {
            $images = is_array($physical->images) && count($physical->images) > 0
                ? array_values($physical->images)
                : [];

            return [
                'id' => $physical->id,
                'product_type' => 'physical',
                'title' => $physical->title,
                'description' => $physical->description,
                'price' => (float) $physical->price,
                'currency' => $physical->currency,
                'symbol' => $this->currencySymbol($physical->currency),
                'images' => $images,
                'cover_url' => $images[0] ?? null,
                'in_stock' => $physical->inStock(),
                'stock_quantity' => $physical->stock_quantity,
            ];
        }

        $digital = DigitalProduct::find($stream->pinned_product_id);
        if ($digital) {
            return [
                'id' => $digital->id,
                'product_type' => 'digital',
                'title' => $digital->title,
                'description' => $digital->description,
                'price' => (float) $digital->price,
                'currency' => $digital->currency,
                'symbol' => $this->currencySymbol($digital->currency),
                'images' => $digital->cover_url ? [$digital->cover_url] : [],
                'cover_url' => $digital->cover_url,
                'in_stock' => true,
                'is_free' => (bool) $digital->is_free,
            ];
        }

        return null;
    }

    private function currencySymbol(?string $currency): string
    {
        return match ($currency) {
            'NGN' => '₦',
            'EUR' => '€',
            'GBP' => '£',
            default => '$',
        };
    }

    private function digitalDownloadUrl(DigitalProduct $product): string
    {
        return url('/api/v1/products/'.$product->id.'/download');
    }

    private function generateOrderNumber(string $prefix): string
    {
        return $prefix.now()->format('Ymd').'-'.strtoupper(Str::random(6));
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
