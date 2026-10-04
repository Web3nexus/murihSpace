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
use App\Events\LiveStreamEnded;
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
use Illuminate\Validation\Rule;

class LiveStreamController extends Controller
{
    public const DIGITAL_FEE_RATE = 0.10;

    public const PHYSICAL_FEE_RATE = 0.05;

    public function __construct(
        private readonly LiveKitService $liveKitService,
        private readonly LiveStreamAttributionService $liveAttributions,
        private readonly NotificationService $notifications,
        private readonly \App\Services\LiveStreamPresenceService $presence,
        private readonly \App\Services\LiveKitAdminService $liveKitAdmin,
        private readonly WalletService $walletService,
        private readonly LedgerService $ledgerService,
        private readonly FeeCalculatorService $feeCalculator,
        private readonly TaxCalculationService $taxService,
        private readonly AccountingStreamService $accountingService,
        private readonly \App\Services\Commission\CommissionService $commissionService,
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

        $viewerContext = [
            'is_host' => false,
            'has_joined' => false,
            'last_joined_at' => null,
        ];
        if ($viewer = $request->user('sanctum') ?? $request->user()) {
            $participant = LiveStreamParticipant::where('live_stream_id', $stream->id)
                ->where('user_id', $viewer->id)
                ->first();

            $viewerContext = [
                'is_host' => (int) $stream->user_id === (int) $viewer->id,
                'has_joined' => $participant !== null,
                'last_joined_at' => $participant?->joined_at?->toIso8601String(),
            ];
        }

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
            'viewer_context' => $viewerContext,
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
            'ended_at' => $stream->ended_at?->toIso8601String(),
            'summary' => [
                'total_likes' => $stream->likes_count,
                'peak_viewers' => $stream->peak_viewers,
                'total_coins_earned' => $stream->total_coins_earned,
            ],
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
        $previousStreams = LiveStream::where('user_id', $user->id)
            ->where('status', 'live')
            ->get();

        foreach ($previousStreams as $previousStream) {
            $previousStream->update([
                'status' => 'ended',
                'ended_at' => now(),
            ]);

            LiveStreamParticipant::where('live_stream_id', $previousStream->id)
                ->where('is_active', true)
                ->update([
                    'is_active' => false,
                    'left_at' => now(),
                ]);

            try {
                LiveStreamEnded::dispatch($previousStream, [
                    'total_likes' => $previousStream->likes_count,
                    'peak_viewers' => $previousStream->peak_viewers,
                    'total_coins_earned' => $previousStream->total_coins_earned,
                    'duration_seconds' => $previousStream->started_at ? $previousStream->ended_at->diffInSeconds($previousStream->started_at) : 0,
                ]);
            } catch (\Throwable $e) {
                \Log::warning('[LiveStreamController] LiveStreamEnded broadcast failed: '.$e->getMessage(), ['stream_id' => $previousStream->id]);
            }
        }

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
        $isHost = (int) $user->id === (int) $stream->user_id;

        // Register presence (and announce the arrival to the host's roster).
        $participant = $this->presence->join(
            $stream,
            (int) $user->id,
            $isHost ? LiveStreamParticipant::ROLE_HOST : LiveStreamParticipant::ROLE_VIEWER,
        );

        // Recalculate real active viewer count
        $activeCount = $this->presence->refreshCounts($stream);

        $this->liveAttributions->record($request, $stream, 'join');

        // A co-host/promoted participant may publish; a restricted one may not,
        // and a restriction must not be undone simply by rejoining the stream.
        $canPublish = $isHost
            || ($participant->canModerate() && ! $participant->is_restricted);

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
                    'role' => $participant->role,
                ]),
                canPublish: $canPublish,
                canSubscribe: true,
                name: $user->name,
                // Not room-admin. Broadcast moderation is enforced server-side
                // against the roster via LiveKitAdminService; a client-side grant
                // would only offer a way around those checks.
                roomAdmin: false,
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
                'is_publisher' => $canPublish,
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

        $this->presence->leave($stream, (int) $user->id);

        $activeCount = $this->presence->refreshCounts($stream);
        $this->liveAttributions->record($request, $stream, 'leave');

        return response()->json([
            'message' => 'Left live stream.',
            'viewers_count' => $activeCount,
        ]);
    }

    // ── Host participant management (server-authorized) ─────────────────────

    /**
     * Full participant roster for the host's moderation panel.
     *
     * Also reconciles against the media server first so the panel reflects
     * reality rather than whatever the browser last reported.
     */
    public function participants(Request $request, int $id): JsonResponse
    {
        $stream = LiveStream::findOrFail($id);
        $user = $request->user();

        $moderator = $this->presence->moderatorFor($stream, (int) $user->id, (bool) $user->isAdmin());

        if (! $moderator) {
            return response()->json(['message' => 'Only the broadcast host or a moderator can view participants.'], 403);
        }

        // Reconciled only once the caller is entitled to the roster. Reconciliation
        // mutates participant rows and calls the media server; doing it before the
        // authorisation check would let any viewer drive that work.
        $this->presence->reconcile($stream);

        $active = $this->presence->refreshCounts($stream);

        return response()->json([
            'success' => true,
            'data' => [
                'stream_id' => $stream->id,
                'role' => $moderator->role,
                'can_moderate' => true,
                'participants' => $this->presence->roster($stream),
                'active_count' => $active,
            ],
        ]);
    }

    /**
     * Promote/demote a participant (co-host / moderator / viewer).
     */
    public function updateParticipantRole(Request $request, int $id, int $userId): JsonResponse
    {
        $validated = $request->validate([
            'role' => ['required', 'string', Rule::in([
                LiveStreamParticipant::ROLE_CO_HOST,
                LiveStreamParticipant::ROLE_MODERATOR,
                LiveStreamParticipant::ROLE_VIEWER,
            ])],
        ]);

        $stream = LiveStream::findOrFail($id);

        // Stricter than authorizeLiveModerator, which admits moderators. Letting
        // a moderator promote somebody to co-host is a privilege ladder: the
        // target outranks the actor and can then remove the role that allowed
        // the promotion. Assigning roles is the host's call.
        $actor = $request->user();
        $isHost = (int) $stream->user_id === (int) $actor->id;
        if (! $isHost && ! $actor->isAdmin()) {
            return response()->json(['message' => 'Only the broadcast host can change participant roles.'], 403);
        }

        if ((int) $stream->user_id === $userId) {
            return response()->json(['message' => 'The broadcast host role cannot be changed.'], 400);
        }

        if ((int) $actor->user_id === $userId) {
            return response()->json(['message' => 'You cannot change your own role.'], 403);
        }

        $target = $this->presence->participantFor($stream, $userId);

        if (! $target) {
            return response()->json(['message' => 'That participant is not in this broadcast.'], 404);
        }

        $role = $validated['role'];
        $this->presence->setRole($stream, $target, $role);

        return response()->json([
            'message' => "Participant role changed to {$role}.",
            'data' => ['participants' => $this->presence->activeRoster($stream)],
        ]);
    }

    /**
     * Force a participant's microphone off in the room.
     */
    public function muteParticipant(Request $request, int $id, int $userId): JsonResponse
    {
        $stream = LiveStream::findOrFail($id);
        $actor = $this->authorizeLiveModerator($request, $stream);

        if ((int) $stream->user_id === $userId) {
            return response()->json(['message' => 'The broadcast host cannot be muted.'], 400);
        }

        if ((int) $actor->user_id === $userId) {
            return response()->json(['message' => 'You cannot mute yourself.'], 403);
        }

        $target = $this->presence->participantFor($stream, $userId);

        if (! $target || ! $target->is_active) {
            return response()->json(['message' => 'That participant is not in this broadcast.'], 404);
        }

        $this->presence->mute($stream, $target);

        return response()->json([
            'message' => 'Participant microphone muted.',
            'data' => ['participants' => $this->presence->activeRoster($stream)],
        ]);
    }

    /**
     * Restrict (revoke publish rights) or restore a participant.
     */
    public function restrictParticipant(Request $request, int $id, int $userId): JsonResponse
    {
        $validated = $request->validate([
            'restricted' => ['required', 'boolean'],
        ]);

        $stream = LiveStream::findOrFail($id);
        $actor = $this->authorizeLiveModerator($request, $stream);

        if ((int) $stream->user_id === $userId) {
            return response()->json(['message' => 'The broadcast host cannot be restricted.'], 400);
        }

        if ((int) $actor->user_id === $userId) {
            return response()->json(['message' => 'You cannot change your own access.'], 403);
        }

        $target = $this->presence->participantFor($stream, $userId);

        if (! $target || ! $target->is_active) {
            return response()->json(['message' => 'That participant is not in this broadcast.'], 404);
        }

        $restricted = (bool) $validated['restricted'];
        $mediaSynced = $this->presence->setRestricted($stream, $target, $restricted);

        if ($this->liveKitAdmin->isConfigured() && ! $mediaSynced) {
            return response()->json([
                'message' => 'The broadcast service is unavailable, so access could not be changed. Try again shortly.',
            ], 503);
        }

        return response()->json([
            'message' => $restricted ? 'Participant restricted.' : 'Participant access restored.',
            'data' => ['participants' => $this->presence->activeRoster($stream)],
        ]);
    }

    /**
     * Remove a participant from the broadcast.
     */
    public function removeParticipant(Request $request, int $id, int $userId): JsonResponse
    {
        $stream = LiveStream::findOrFail($id);
        $actor = $this->authorizeLiveModerator($request, $stream);

        if ((int) $stream->user_id === $userId) {
            return response()->json(['message' => 'The broadcast host cannot be removed.'], 400);
        }

        if ((int) $actor->user_id === $userId) {
            return response()->json(['message' => 'You cannot remove yourself.'], 403);
        }

        $target = $this->presence->participantFor($stream, $userId);

        if (! $target || ! $target->is_active) {
            return response()->json(['message' => 'That participant is not in this broadcast.'], 404);
        }

        $this->presence->remove($stream, $target);
        $this->presence->refreshCounts($stream);

        return response()->json([
            'message' => 'Participant removed from the broadcast.',
            'data' => ['participants' => $this->presence->activeRoster($stream)],
        ]);
    }

    /**
     * Every live moderation route funnels through here so a viewer can never
     * reach a host API by guessing the URL.
     */
    private function authorizeLiveModerator(Request $request, LiveStream $stream): LiveStreamParticipant
    {
        $user = $request->user();
        $moderator = $this->presence->moderatorFor($stream, (int) $user->id, (bool) $user->isAdmin());

        if (! $moderator) {
            abort(403, 'Only the broadcast host or a moderator can perform this action.');
        }

        return $moderator;
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
            ->orderBy('id', 'desc')
            ->limit(50)
            ->get()
            ->reverse()
            ->values();

        // Enrich real gift rows (created by sendGift with a persisted gift_id)
        // with the actual gift artwork + price so mobile viewers render the
        // real image and the correct animation tier. Messages are only enriched
        // when they carry a gift_id — a viewer typing "🎁 …" by hand is
        // ordinary chat text and never spoofs a gift celebration.
        $giftIndex = Gift::active()->get()->keyBy('id');

        $messages->transform(function (LiveStreamMessage $m) use ($giftIndex) {
            $gift = $m->gift_id ? $giftIndex->get($m->gift_id) : null;
            if (! $gift) {
                return $m;
            }

            $coinPrice = (int) $gift->coin_price;
            $m->gift_id = $gift->id;
            $m->gift_name = $gift->name;
            $m->gift_icon_url = $gift->icon_url;
            $m->coin_price = $coinPrice;
            $m->animation_type = Gift::animationTierFor($coinPrice);

            return $m;
        });

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
                'gift_id' => $gift->id,
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
        $platformFee = (int) round($this->commissionService->calculateFee($subtotal, 'physical'));

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
        $platformFee = $this->commissionService->calculateFee($subtotal, 'digital');

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

        // Drop every remaining viewer from the media room so the LiveKit
        // session genuinely closes when the host ends the broadcast. Removing
        // only the host left viewers connected to a stream the database had
        // already marked ended.
        $this->liveKitAdmin->removeAllParticipants(
            $stream->livekit_room,
            $this->presence->identityFor(
                LiveStreamParticipant::where('live_stream_id', $stream->id)
                    ->where('user_id', $stream->user_id)
                    ->first()
                    ?? new LiveStreamParticipant(['live_stream_id' => $stream->id, 'user_id' => $stream->user_id])
            ),
        );

        $summary = [
            'total_likes' => $stream->likes_count,
            'peak_viewers' => $stream->peak_viewers,
            'total_coins_earned' => $stream->total_coins_earned,
            'duration_seconds' => $stream->started_at ? $stream->ended_at->diffInSeconds($stream->started_at) : 0,
        ];

        // Tell every viewer still on this stream that the live is over.
        try {
            LiveStreamEnded::dispatch($stream, $summary);
        } catch (\Throwable $e) {
            \Log::warning('[LiveStreamController] LiveStreamEnded broadcast failed: '.$e->getMessage(), ['stream_id' => $stream->id]);
        }

        return response()->json([
            'message' => 'Live stream ended successfully.',
            'stream' => $stream->fresh(),
            'summary' => $summary,
        ]);
    }
}
