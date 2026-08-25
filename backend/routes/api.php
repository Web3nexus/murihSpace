<?php

use App\Http\Controllers\AdminAnalyticsController;
use App\Http\Controllers\AdminDashboardController;
use App\Http\Controllers\AdminKycController;
use App\Http\Controllers\AdminManagementController;
use App\Http\Controllers\AdminPlansController;
use App\Http\Controllers\AdminUserController;
use App\Http\Controllers\AdminWalletController;
use App\Http\Controllers\AdminFeeController;
use App\Http\Controllers\FeeController;
use App\Http\Controllers\AdminStorageController;
use App\Http\Controllers\AnalyticsController;
use App\Http\Controllers\AudioRoomController;
use App\Http\Controllers\AddressController;
use App\Http\Controllers\BrandController;
use App\Http\Controllers\CountryController;
use App\Http\Controllers\BrandDealController;
use App\Http\Controllers\BrandDealMilestoneController;
use App\Http\Controllers\BrandDealProposalController;
use App\Http\Controllers\BrandInvoiceController;
use App\Http\Controllers\AuditLogController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\BadgeController;
use App\Http\Controllers\BlockController;
use App\Http\Controllers\CartController;
use App\Http\Controllers\CheckoutController;
use App\Http\Controllers\ActivityLogController;
use App\Http\Controllers\ContentPlannerController;
use App\Http\Controllers\CurrencyController;
use App\Http\Controllers\CoachingBookingController;
use App\Http\Controllers\CoachingServiceController;
use App\Http\Controllers\CommunityController;
use App\Http\Controllers\ConversationController;
use App\Http\Controllers\ConversationSettingsController;
use App\Http\Controllers\DigitalProductController;
use App\Http\Controllers\DonationController;
use App\Http\Controllers\EmailBroadcastController;
use App\Http\Controllers\EmailSequenceController;
use App\Http\Controllers\EscrowController;
use App\Http\Controllers\EventController;
use App\Http\Controllers\FeatureFlagController;
use App\Http\Controllers\FriendRequestController;
use App\Http\Controllers\FulfilmentDisputeController;
use App\Http\Controllers\FulfilmentOrderController;
use App\Http\Controllers\FulfilmentPayoutController;
use App\Http\Controllers\KycController;
use App\Http\Controllers\MediaKitController;
use App\Http\Controllers\MembershipController;
use App\Http\Controllers\MessageAttachmentController;
use App\Http\Controllers\MessageReactionController;
use App\Http\Controllers\MilestoneController;
use App\Http\Controllers\ModerationController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\NotificationPreferenceController;
use App\Http\Controllers\OrderController;
use App\Http\Controllers\PageSectionController;
use App\Http\Controllers\PasswordResetController;
use App\Http\Controllers\PhysicalProductController;
use App\Http\Controllers\PostController;
use App\Http\Controllers\ReactionController;
use App\Http\Controllers\AdController;
use App\Http\Controllers\AdminAdController;
use App\Http\Controllers\GiftController;
use App\Http\Controllers\CoinPackController;
use App\Http\Controllers\FeedController;
use App\Http\Controllers\ProductReviewController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\PurchaseController;
use App\Http\Controllers\PushTokenController;
use App\Http\Controllers\ReconciliationController;
use App\Http\Controllers\ReferralController;
use App\Http\Controllers\RoleController;
use App\Http\Controllers\SearchController;
use App\Http\Controllers\ShippingProfileController;
use App\Http\Controllers\SocialAuthController;
use App\Http\Controllers\StoryController;
use App\Http\Controllers\StorefrontController;
use App\Http\Controllers\StorePostController;
use App\Http\Controllers\SubscriptionController;
use App\Http\Controllers\SubscriptionPlanController;
use App\Http\Controllers\TransferController;
use App\Http\Controllers\VerificationController;
use App\Http\Controllers\WalletController;
use App\Http\Controllers\WithdrawalController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function () {
    // Service readiness check
    Route::get('/ready', function (Request $request) {
        try {
            DB::connection()->getPdo();
            $dbReady = true;
        } catch (Exception $e) {
            $dbReady = false;
        }

        return response()->json([
            'status' => 'ready',
            'api_version' => 'v1',
            'services' => [
                'database' => $dbReady ? 'connected' : 'disconnected',
            ],
        ]);
    });

    // Master Permissions Matrix
    Route::get('/permissions-matrix', [RoleController::class, 'permissionsMatrix']);

    // Sumsub KYC webhook (public, signature-verified)
    Route::post('/webhooks/sumsub', fn (\Illuminate\Http\Request $r) => app(\App\Http\Controllers\KycController::class)->webhook($r, app(\App\Services\Kyc\KycProviderManager::class), 'sumsub'))->middleware('throttle:30,1');

    // Didit KYC webhook (public, signature-verified)
    Route::post('/webhooks/didit', fn (\Illuminate\Http\Request $r) => app(\App\Http\Controllers\KycController::class)->webhook($r, app(\App\Services\Kyc\KycProviderManager::class), 'didit'))->middleware('throttle:30,1');

    // Public platform config (used by login/registration + app-lock screens)
    Route::get('/platform', [\App\Http\Controllers\PlatformController::class, 'config'])->middleware('cache.public:30');

    // Authentication Routes
    Route::prefix('auth')->group(function () {
        Route::post('/register', [AuthController::class, 'register'])->middleware('throttle:auth');
        Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:auth');
        Route::get('/check-username/{username}', [AuthController::class, 'checkUsername'])->middleware('throttle:60,1');

        // Public authentication-method config (no secrets) used to render login/registration.
        Route::get('/methods', [\App\Http\Controllers\AuthMethodConfigController::class, 'publicConfig'])
            ->middleware('cache.public:30');

        // Phone OTP verification (Twilio Verify in production).
        Route::prefix('otp')->group(function () {
            Route::post('/request', [\App\Http\Controllers\PhoneOtpController::class, 'request'])->middleware('throttle:otp');
            Route::post('/verify', [\App\Http\Controllers\PhoneOtpController::class, 'verify'])->middleware('throttle:otp');
        });

        // Password Reset
        Route::post('/forgot-password', [PasswordResetController::class, 'forgotPassword'])->middleware('throttle:auth');
        Route::post('/reset-password', [PasswordResetController::class, 'resetPassword'])->middleware('throttle:auth');

        // Social Auth
        Route::prefix('social')->group(function () {
            Route::get('/{provider}/redirect', [SocialAuthController::class, 'redirect']);
            Route::match(['get', 'post'], '/{provider}/callback', [SocialAuthController::class, 'callback']);
        });

        Route::middleware('auth:sanctum')->group(function () {
            Route::post('/logout', [AuthController::class, 'logout']);
            Route::post('/email/send-code', [VerificationController::class, 'sendCode']);
            Route::post('/email/verify-code', [VerificationController::class, 'verifyCode']);
            Route::post('/email/resend', [VerificationController::class, 'resend']);
            Route::put('/password', [AuthController::class, 'updatePassword']);
            Route::prefix('2fa')->group(function () {
                Route::post('/enable', [AuthController::class, 'enable2fa']);
                Route::post('/disable', [AuthController::class, 'disable2fa']);
                Route::post('/confirm', [AuthController::class, 'confirm2fa']);
                Route::get('/status', [AuthController::class, 'status2fa']);
            });
            Route::get('/sessions', [AuthController::class, 'sessions']);
            Route::delete('/sessions/{id}', [AuthController::class, 'destroySession']);
        });

        Route::get('/email/verify/{id}/{hash}', [VerificationController::class, 'verify'])
            ->middleware('signed')
            ->name('verification.verify');
    });

    // Public Country & Location Endpoints
    Route::get('/countries', [CountryController::class, 'index']);
    Route::get('/countries/{iso2}/states', [CountryController::class, 'states']);

    // Public Community, Membership & Feed Endpoints
    Route::prefix('communities')->middleware('cache.public:10')->group(function () {
        Route::get('/', [CommunityController::class, 'index']);
        Route::get('/{slug}', [CommunityController::class, 'show']);
        Route::get('/{id}/members', [MembershipController::class, 'members']);
        Route::get('/{id}/roles', [RoleController::class, 'index']);
        Route::get('/{id}/posts', [PostController::class, 'index']);
    });

    Route::get('/feed', [PostController::class, 'globalFeed'])->middleware('cache.public:5');

    // Public Storefront Profile Endpoint
    Route::get('/stores/{shortCode}', [StorefrontController::class, 'show'])->middleware('cache.public:10');
    Route::get('/stores/{shortCode}/posts', [StorePostController::class, 'publicPosts'])->middleware('cache.public:5');

    // Public Link-in-Bio Page
    Route::get('/l/{username}', [\App\Http\Controllers\LinkInBioController::class, 'publicPage'])->middleware('cache.public:10');

    // Link in Bio Click Redirect (public)
    Route::get('/l/click/{linkId}', [\App\Http\Controllers\LinkInBioController::class, 'redirectClick'])->middleware('throttle:60,1');

    // Affiliate Product Click Redirect (public)
    Route::get('/l/affiliate/{product}', [\App\Http\Controllers\AffiliateProductController::class, 'redirectClick'])->middleware('throttle:60,1');

    // Short Link Redirect (public)
    Route::get('/s/{code}', [\App\Http\Controllers\ShortLinkController::class, 'redirect'])->middleware('throttle:60,1');
    Route::get('/public/products/{slug}', [DigitalProductController::class, 'publicShow']);

    // Sprint 15: Public payment webhook (no auth — provider calls this)
    Route::post('/checkout/webhooks/{provider}', [CheckoutController::class, 'handleWebhook'])->middleware('throttle:30,1');

    // Sprint 20: Public Event Endpoints
    Route::prefix('events')->middleware('throttle:60,1')->group(function () {
        Route::get('/', [EventController::class, 'index']);
        Route::get('/{id}', [EventController::class, 'show']);
    });

    // Sprint 30: Public physical product listing (no auth required)
    Route::get('/store/physical-products', [PhysicalProductController::class, 'indexPublic']);

    // Sprint 33: Public product reviews (no auth required)
    Route::get('/store/products/{productId}/reviews', [ProductReviewController::class, 'index']);

    // Sprint 34: Public shipping estimate (no auth required)
    Route::post('/shipping/estimate', [ShippingProfileController::class, 'estimate']);

    // Sprint 36: Public milestones & badges
    Route::get('/milestones/creator/{creatorId}', [MilestoneController::class, 'publicMilestones']);
    Route::get('/badges', [BadgeController::class, 'index']);

    // Sprint 37: Public referral click tracking
    Route::post('/ref/{code}/click', [ReferralController::class, 'trackClick']);

    // Sprint B: Public community discovery (no auth required)
    Route::get('/public/communities', [CommunityController::class, 'publicIndex']);

    // Sprint 38: Public brand listing & media kit
    Route::get('/brands', [BrandController::class, 'index']);
    Route::get('/brands/{id}', [BrandController::class, 'show']);
    Route::get('/media-kit/{creatorId}', [MediaKitController::class, 'publicShow']);

    // Sprint 19: System health (no auth required)
    Route::get('/health', function () {
        $dbConnected = false;
        $cacheConnected = false;
        $queueResponsive = false;
        $redisConnected = false;

        try {
            DB::connection()->getPdo();
            $dbConnected = true;
        } catch (Exception $e) {
            $dbConnected = false;
        }

        try {
            $cacheConnected = Cache::set('health-check', true, 10);
        } catch (Exception $e) {
            $cacheConnected = false;
        }

        try {
            $queueResponsive = Queue::size() >= 0;
        } catch (Exception $e) {
            $queueResponsive = false;
        }

        try {
            $redisConnected = app('redis')->command('ping') === 'PONG';
        } catch (Exception $e) {
            $redisConnected = false;
        }

        $overall = 'healthy';
        if (! $dbConnected || ! $cacheConnected) {
            $overall = 'degraded';
        }
        if (! $dbConnected) {
            $overall = 'down';
        }

        return response()->json([
            'status' => $overall,
            'timestamp' => now()->toIso8601String(),
            'api_version' => 'v1',
            'environment' => app()->environment(),
            'services' => [
                'database' => $dbConnected ? 'connected' : 'disconnected',
                'cache' => $cacheConnected ? 'connected' : 'disconnected',
                'queue' => $queueResponsive ? 'responsive' : 'unresponsive',
                'redis' => $redisConnected ? 'connected' : 'disconnected',
            ],
            'uptime' => function_exists('exec') ? @exec('uptime') : null,
        ]);
    });

    // Authenticated Endpoints
    Route::middleware('auth:sanctum', 'throttle:api')->group(function () {
        // Search
        Route::get('/search', [SearchController::class, 'search']);

        Route::get('/user', function (Request $request) {
            $user = $request->user();

            return response()->json([
                'id'             => $user->id,
                'name'           => $user->name,
                'email'          => $user->email,
                'username'       => $user->username,
                'role'           => $user->role,
                'permissions'    => $user->permissions(),
                'kyc_status'     => $user->kyc_status,
                'email_verified' => $user->hasVerifiedEmail(),
                'verification_badge' => [
                    'status'     => $user->verification_badge_status,
                    'active'     => $user->hasActiveVerificationBadge(),
                    'expires_at' => $user->verification_badge_expires_at?->toIso8601String(),
                ],
            ]);
        });

        // Feature flags (read-only for all authenticated users)
        Route::get('/feature-flags', [FeatureFlagController::class, 'index']);

        // ── File Uploads ────────────────────────────────────────────────
        Route::prefix('upload')->group(function () {
            Route::get('/', [\App\Http\Controllers\UploadController::class, 'index']);
            Route::post('/', [\App\Http\Controllers\UploadController::class, 'store']);
            Route::delete('/{media}', [\App\Http\Controllers\UploadController::class, 'destroy']);
        });

        // Profile Management
        Route::prefix('profile')->group(function () {
            Route::get('/', [ProfileController::class, 'show']);
            Route::put('/', [ProfileController::class, 'update']);
            Route::post('/kyc', [ProfileController::class, 'submitKyc']);
            Route::post('/switch-role', [ProfileController::class, 'switchRole']);
        });

        // My Communities
        Route::prefix('my-communities')->group(function () {
            Route::get('/', [CommunityController::class, 'myCommunities']);
            Route::post('/', [CommunityController::class, 'store'])->middleware('creator');
            Route::put('/{community}', [CommunityController::class, 'update']);
            Route::delete('/{community}', [CommunityController::class, 'destroy']);
        });

        // Community Actions
        Route::prefix('communities/{id}')->group(function () {
            Route::post('/join', [MembershipController::class, 'join']);
            Route::post('/leave', [MembershipController::class, 'leave']);
            Route::get('/membership-status', [MembershipController::class, 'status']);
            Route::get('/requests', [MembershipController::class, 'pendingRequests']);
            Route::post('/roles', [RoleController::class, 'store']);
        });

        // Posts, Comments & Reactions
        Route::prefix('posts')->group(function () {
            Route::post('/', [PostController::class, 'store']);
            Route::get('/saved', [PostController::class, 'savedPosts']);
            Route::put('/{id}', [PostController::class, 'update']);
            Route::delete('/{id}', [PostController::class, 'destroy']);
            Route::post('/{id}/pin', [PostController::class, 'pin']);
            Route::post('/{id}/unpin', [PostController::class, 'unpin']);
            Route::get('/{id}/comments', [PostController::class, 'getComments']);
            Route::post('/{id}/comments', [PostController::class, 'addComment']);
            Route::post('/{id}/reactions/toggle', [ReactionController::class, 'togglePostReaction']);
            Route::post('/{id}/share', [PostController::class, 'share']);
            Route::post('/{id}/save', [PostController::class, 'toggleSave']);
            Route::post('/{id}/report', [PostController::class, 'report']);
        });

        // Comment reactions (like/dislike)
        Route::prefix('comments')->group(function () {
            Route::post('/{id}/reactions', [ReactionController::class, 'toggleCommentReaction']);
        });

        // Stories
        Route::prefix('stories')->group(function () {
            Route::get('/', [StoryController::class, 'index']);
            Route::post('/', [StoryController::class, 'store']);
            Route::delete('/{id}', [StoryController::class, 'destroy']);
        });

        // Membership Management
        Route::prefix('memberships/{id}')->group(function () {
            Route::post('/approve', [MembershipController::class, 'approve']);
            Route::post('/reject', [MembershipController::class, 'reject']);
            Route::post('/assign-role', [RoleController::class, 'assign']);
        });

        // ── Sprint 9: Moderation ───────────────────────────────────────────
        Route::post('/reports', [ModerationController::class, 'report']);

        Route::prefix('users/{userId}')->group(function () {
            Route::post('/block', [BlockController::class, 'block']);
            Route::delete('/block', [BlockController::class, 'unblock']);
            Route::post('/mute', [BlockController::class, 'mute']);
            Route::delete('/mute', [BlockController::class, 'unmute']);
        });

        Route::get('/blocked-users', [BlockController::class, 'blocked']);
        Route::get('/muted-users', [BlockController::class, 'muted']);

        // ── Sprint 9: Notifications ────────────────────────────────────────
        Route::prefix('notifications')->group(function () {
            Route::get('/', [NotificationController::class, 'index']);
            Route::post('/read-all', [NotificationController::class, 'markAllRead']);
            Route::post('/{id}/read', [NotificationController::class, 'markRead']);
        });

        Route::prefix('notification-preferences')->group(function () {
            Route::get('/', [NotificationPreferenceController::class, 'index']);
            Route::put('/', [NotificationPreferenceController::class, 'update']);
        });

        // ── Sprint 10: Conversations & Messaging ────────────────────────────
        Route::prefix('conversations')->group(function () {
            Route::get('/', [ConversationController::class, 'index']);
            Route::post('/direct', [ConversationController::class, 'startDirect']);
            Route::get('/community/{communityId}', [ConversationController::class, 'getCommunityChat']);
            Route::get('/saved', [ConversationController::class, 'getSavedMessages']);
            Route::get('/{id}/messages', [ConversationController::class, 'messages']);
            Route::post('/{id}/messages', [ConversationController::class, 'sendMessage']);
            Route::post('/{id}/read', [ConversationController::class, 'markRead']);
            // Sprint 12
            Route::post('/{id}/typing', [ConversationController::class, 'typing']);
            Route::get('/{id}/settings', [ConversationSettingsController::class, 'show']);
            Route::put('/{id}/settings', [ConversationSettingsController::class, 'update']);
            // Message deletion
            Route::delete('/{conversationId}/messages/{messageId}', [ConversationController::class, 'deleteMessage']);
        });

        // ── Sprint 11-12: Messages, Reactions, Attachments, Push Tokens ──
        Route::prefix('messages')->group(function () {
            Route::post('/attachments', [MessageAttachmentController::class, 'upload']);
            Route::post('/{id}/reactions', [MessageReactionController::class, 'toggle']);
            Route::get('/{id}/reactions', [MessageReactionController::class, 'index']);
            Route::post('/{id}/forward', [\App\Http\Controllers\ConversationController::class, 'forwardMessage']);
        });

        // Secure chat media access
        Route::prefix('chat')->group(function () {
            Route::get('/media/{media}', [\App\Http\Controllers\ChatMediaController::class, 'show']);
        });

        Route::prefix('push-tokens')->group(function () {
            Route::post('/', [PushTokenController::class, 'store']);
            Route::delete('/', [PushTokenController::class, 'destroy']);
        });

        // ── Sprint 13: Creator Storefront ──────────────────────────────────
        Route::prefix('storefront')->middleware('creator')->group(function () {
            Route::get('/', [StorefrontController::class, 'mine']);
            Route::put('/', [StorefrontController::class, 'update']);
            Route::post('/publish', [StorefrontController::class, 'publish']);
        });

        Route::prefix('store/posts')->middleware('creator')->group(function () {
            Route::get('/', [StorePostController::class, 'index']);
            Route::post('/', [StorePostController::class, 'store']);
            Route::put('/{id}', [StorePostController::class, 'update']);
            Route::delete('/{id}', [StorePostController::class, 'destroy']);
        });

        // ── Sprint 14: Digital Products ────────────────────────────────────
        Route::prefix('store/products')->middleware('creator', 'kyc')->group(function () {
            Route::get('/', [DigitalProductController::class, 'index']);
            Route::post('/', [DigitalProductController::class, 'store']);
            Route::get('/{id}', [DigitalProductController::class, 'show']);
            Route::put('/{id}', [DigitalProductController::class, 'update']);
            Route::post('/{id}/publish', [DigitalProductController::class, 'publish']);
            Route::delete('/{id}', [DigitalProductController::class, 'destroy']);
        });
        Route::get('/products/{id}/download', [DigitalProductController::class, 'download']);

        // ── Sprint 30: Physical Products & Inventory ──────────────────────
        Route::prefix('store/physical-products')->middleware('kyc')->group(function () {
            Route::get('/my', [PhysicalProductController::class, 'myProducts']);
            Route::post('/', [PhysicalProductController::class, 'store']);
            Route::get('/{id}', [PhysicalProductController::class, 'show']);
            Route::put('/{id}', [PhysicalProductController::class, 'update']);
            Route::delete('/{id}', [PhysicalProductController::class, 'destroy']);
            Route::post('/{id}/stock', [PhysicalProductController::class, 'adjustStock']);
        });

                // ── Sprint 31: Cart & Address ────────────────────────────────────
        Route::prefix('store/cart')->group(function () {
            Route::get('/', [CartController::class, 'show']);
            Route::post('/items', [CartController::class, 'addItem']);
            Route::put('/items/{id}', [CartController::class, 'updateItem']);
            Route::delete('/items/{id}', [CartController::class, 'removeItem']);
            Route::delete('/', [CartController::class, 'clear']);
        });

        Route::prefix('addresses')->group(function () {
            Route::get('/', [AddressController::class, 'index']);
            Route::post('/', [AddressController::class, 'store']);
            Route::put('/{id}', [AddressController::class, 'update']);
            Route::delete('/{id}', [AddressController::class, 'destroy']);
            Route::post('/{id}/default', [AddressController::class, 'setDefault']);
        });

        // ── Store Categories ──────────────────────────────────────────
        Route::prefix('store/categories')->middleware('creator')->group(function () {
            Route::get('/', [\App\Http\Controllers\StoreCategoryController::class, 'index']);
            Route::post('/', [\App\Http\Controllers\StoreCategoryController::class, 'store']);
            Route::patch('/{category}', [\App\Http\Controllers\StoreCategoryController::class, 'update']);
            Route::delete('/{category}', [\App\Http\Controllers\StoreCategoryController::class, 'destroy']);
        });

        // ── Store Inventory ──────────────────────────────────────────
        Route::prefix('store/inventory')->middleware('creator')->group(function () {
            Route::get('/', [\App\Http\Controllers\StoreInventoryController::class, 'index']);
            Route::patch('/{product}', [\App\Http\Controllers\StoreInventoryController::class, 'update']);
        });

        // ── Store Returns ────────────────────────────────────────────
        Route::prefix('store/returns')->group(function () {
            Route::get('/', [\App\Http\Controllers\StoreReturnController::class, 'index']);
            Route::post('/', [\App\Http\Controllers\StoreReturnController::class, 'store']);
            Route::put('/{return}', [\App\Http\Controllers\StoreReturnController::class, 'update']);
        });

        // ── Store Membership Plans ───────────────────────────────────
        Route::prefix('store/memberships')->middleware('creator')->group(function () {
            Route::get('/', [\App\Http\Controllers\StoreMembershipPlanController::class, 'index']);
            Route::post('/', [\App\Http\Controllers\StoreMembershipPlanController::class, 'store']);
            Route::patch('/{plan}', [\App\Http\Controllers\StoreMembershipPlanController::class, 'update']);
            Route::delete('/{plan}', [\App\Http\Controllers\StoreMembershipPlanController::class, 'destroy']);
        });

        // ── Store Settings ──────────────────────────────────────────
        Route::prefix('store/settings')->middleware('creator')->group(function () {
            Route::get('/', [\App\Http\Controllers\StoreSettingsController::class, 'show']);
            Route::put('/', [\App\Http\Controllers\StoreSettingsController::class, 'update']);
        });

        // ── Fulfilment & Shipping ────────────────────────────────────
        Route::prefix('store/fulfilment')->group(function () {
            Route::post('/checkout', [FulfilmentOrderController::class, 'checkout']);
            Route::get('/orders', [FulfilmentOrderController::class, 'myOrders']);
            Route::get('/sales', [FulfilmentOrderController::class, 'sales']);
            Route::get('/{id}', [FulfilmentOrderController::class, 'show']);
            Route::get('/{id}/tracking', [FulfilmentOrderController::class, 'trackingEvents']);
            Route::put('/{id}/status', [FulfilmentOrderController::class, 'updateStatus']);
            Route::put('/{id}/tracking', [FulfilmentOrderController::class, 'updateTracking']);
        });

        // ── Sprint 34: Shipping Profiles ──────────────────────────────────────
        Route::prefix('store/shipping')->group(function () {
            Route::get('/profiles', [ShippingProfileController::class, 'index']);
            Route::post('/profiles', [ShippingProfileController::class, 'store']);
            Route::put('/profiles/{id}', [ShippingProfileController::class, 'update']);
            Route::delete('/profiles/{id}', [ShippingProfileController::class, 'destroy']);
        });

        // ── Sprint 35: Fulfilment Payouts ─────────────────────────────────────
        Route::prefix('store/payouts')->group(function () {
            Route::get('/', [FulfilmentPayoutController::class, 'myPayouts']);
            Route::get('/stats', [FulfilmentPayoutController::class, 'stats']);
        });

        // ── Sprint 36: Milestones & Badges ────────────────────────────────────
        Route::prefix('milestones')->middleware('creator')->group(function () {
            Route::get('/', [MilestoneController::class, 'index']);
            Route::post('/', [MilestoneController::class, 'store']);
            Route::put('/{id}', [MilestoneController::class, 'update']);
            Route::delete('/{id}', [MilestoneController::class, 'destroy']);
            Route::get('/my-progress', [MilestoneController::class, 'myProgress']);
            Route::post('/progress', [MilestoneController::class, 'updateProgress']);
        });

        Route::prefix('badges')->group(function () {
            Route::get('/my', [BadgeController::class, 'myBadges']);
            Route::post('/earn', [BadgeController::class, 'earn']);
        });

        // ── Sprint 37: Referral & Affiliate Programs ──────────────────────────
        Route::prefix('referrals')->group(function () {
            Route::get('/stats', [ReferralController::class, 'stats']);
            Route::get('/', [ReferralController::class, 'referrals']);

            // Creator-only program & link management
            Route::middleware('creator')->group(function () {
                Route::get('/program', [ReferralController::class, 'program']);
                Route::put('/program', [ReferralController::class, 'upsertProgram']);
                Route::get('/links', [ReferralController::class, 'links']);
                Route::post('/links', [ReferralController::class, 'createLink']);
                Route::post('/links/{id}/toggle', [ReferralController::class, 'toggleLink']);
                Route::delete('/links/{id}', [ReferralController::class, 'deleteLink']);
            });
        });

        // ── Sprint 38: Brand Deals Hub ────────────────────────────────────────
        Route::middleware('creator')->group(function () {
            Route::prefix('brands')->group(function () {
                Route::post('/', [BrandController::class, 'store']);
            });

            Route::prefix('brand-deals')->group(function () {
                Route::get('/', [BrandDealController::class, 'index']);
                Route::post('/', [BrandDealController::class, 'store']);
                Route::put('/{id}', [BrandDealController::class, 'update']);
                Route::delete('/{id}', [BrandDealController::class, 'destroy']);
                Route::get('/{dealId}/milestones', [BrandDealMilestoneController::class, 'index']);
                Route::post('/{dealId}/milestones', [BrandDealMilestoneController::class, 'store']);
                Route::post('/milestones/{milestoneId}/submit', [BrandDealMilestoneController::class, 'submit']);
                Route::post('/milestones/{milestoneId}/approve', [BrandDealMilestoneController::class, 'approve']);
                Route::post('/milestones/{milestoneId}/dispute', [BrandDealMilestoneController::class, 'dispute']);
            });

            Route::prefix('brand-proposals')->group(function () {
                Route::get('/', [BrandDealProposalController::class, 'index']);
                Route::post('/', [BrandDealProposalController::class, 'store']);
                Route::post('/{id}/send', [BrandDealProposalController::class, 'send']);
                Route::put('/{id}', [BrandDealProposalController::class, 'update']);
                Route::delete('/{id}', [BrandDealProposalController::class, 'destroy']);
            });

            Route::prefix('brand-invoices')->group(function () {
                Route::get('/', [BrandInvoiceController::class, 'index']);
                Route::post('/', [BrandInvoiceController::class, 'store']);
                Route::post('/{id}/mark-sent', [BrandInvoiceController::class, 'markSent']);
                Route::post('/{id}/mark-paid', [BrandInvoiceController::class, 'markPaid']);
                Route::delete('/{id}', [BrandInvoiceController::class, 'destroy']);
            });

            Route::prefix('media-kit')->group(function () {
                Route::get('/', [MediaKitController::class, 'show']);
                Route::put('/', [MediaKitController::class, 'update']);
                Route::get('/preview', [MediaKitController::class, 'preview']);
            });
        });

        // ── Sprint 39: Email Automations & Sequences ──────────────────────────
        Route::prefix('email-broadcasts')->middleware('creator')->group(function () {
            Route::get('/', [EmailBroadcastController::class, 'index']);
            Route::post('/', [EmailBroadcastController::class, 'store']);
            Route::get('/{id}', [EmailBroadcastController::class, 'show']);
            Route::put('/{id}', [EmailBroadcastController::class, 'update']);
            Route::post('/{id}/send', [EmailBroadcastController::class, 'send']);
            Route::delete('/{id}', [EmailBroadcastController::class, 'destroy']);
        });

        Route::prefix('email-sequences')->middleware('creator')->group(function () {
            Route::get('/', [EmailSequenceController::class, 'index']);
            Route::post('/', [EmailSequenceController::class, 'store']);
            Route::put('/{id}', [EmailSequenceController::class, 'update']);
            Route::post('/{id}/toggle', [EmailSequenceController::class, 'toggle']);
            Route::delete('/{id}', [EmailSequenceController::class, 'destroy']);

            Route::get('/{sequenceId}/steps', [EmailSequenceController::class, 'steps']);
            Route::post('/{sequenceId}/steps', [EmailSequenceController::class, 'storeStep']);
            Route::put('/{sequenceId}/steps/{stepId}', [EmailSequenceController::class, 'updateStep']);
            Route::delete('/{sequenceId}/steps/{stepId}', [EmailSequenceController::class, 'deleteStep']);
        });

        // ── Content Studio ──────────────────────────────────────────
        Route::prefix('content')->middleware('creator')->group(function () {
            Route::get('/', [\App\Http\Controllers\ContentItemController::class, 'index']);
            Route::post('/', [\App\Http\Controllers\ContentItemController::class, 'store']);
            Route::patch('/{item}', [\App\Http\Controllers\ContentItemController::class, 'update']);
            Route::delete('/{item}', [\App\Http\Controllers\ContentItemController::class, 'destroy']);
        });

        // ── Support Threads ──────────────────────────────────────────
        Route::prefix('support/threads')->group(function () {
            Route::get('/', [\App\Http\Controllers\SupportController::class, 'index']);
            Route::get('/{thread}/messages', [\App\Http\Controllers\SupportController::class, 'messages']);
            Route::post('/{thread}/messages', [\App\Http\Controllers\SupportController::class, 'sendMessage']);
        });

        // ── My Tickets (proxied to the ticket service) ───────────────
        Route::prefix('tickets')->group(function () {
            Route::get('/categories', [\App\Http\Controllers\TicketProxyController::class, 'categories']);
            Route::get('/', [\App\Http\Controllers\TicketProxyController::class, 'index']);
            Route::post('/', [\App\Http\Controllers\TicketProxyController::class, 'store']);
            Route::get('/{ticket}', [\App\Http\Controllers\TicketProxyController::class, 'show']);
            Route::post('/{ticket}/reply', [\App\Http\Controllers\TicketProxyController::class, 'reply']);
            Route::post('/{ticket}/status', [\App\Http\Controllers\TicketProxyController::class, 'status']);
            Route::post('/{ticket}/rate', [\App\Http\Controllers\TicketProxyController::class, 'rate']);
        });

        // ── Chat Rooms (alias for frontend) ──────────────────────────
        Route::prefix('chat/rooms')->group(function () {
            Route::get('/', [\App\Http\Controllers\ChatRoomController::class, 'rooms']);
            Route::get('/{room}/messages', [\App\Http\Controllers\ChatRoomController::class, 'messages']);
            Route::post('/{room}/messages', [\App\Http\Controllers\ChatRoomController::class, 'sendMessage']);
        });

        // ── Advertising Campaigns ────────────────────────────────────
        Route::prefix('ads')->group(function () {
            Route::get('/', [AdController::class, 'index']);
            Route::post('/', [AdController::class, 'store']);
            Route::get('/{id}', [AdController::class, 'show']);
            Route::put('/{id}', [AdController::class, 'update']);
            Route::delete('/{id}', [AdController::class, 'destroy']);
            Route::post('/{id}/pause', [AdController::class, 'pause']);
            Route::post('/{id}/resume', [AdController::class, 'resume']);
            Route::post('/{id}/duplicate', [AdController::class, 'duplicate']);
            Route::get('/{id}/preview', [AdController::class, 'preview']);
            Route::post('/{id}/submit', [AdController::class, 'submit']);
            Route::get('/{id}/analytics', [AdController::class, 'analytics']);
        });

        // ── Gifts & Creator Wallets ─────────────────────────────────
        Route::prefix('gifts')->group(function () {
            Route::get('/catalogue', [GiftController::class, 'catalogue']);
            Route::post('/send', [GiftController::class, 'send'])->middleware('verified');
            Route::get('/transactions', [GiftController::class, 'transactions']);
            Route::get('/leaderboard/{sessionId}', [GiftController::class, 'leaderboard']);
        });

        // ── Coin Packs (buy coins for wallet) ───────────────────────
        Route::prefix('coins')->middleware('verified')->group(function () {
            Route::get('/packs', [CoinPackController::class, 'catalogue']);
            Route::post('/purchase', [CoinPackController::class, 'purchase']);
            Route::get('/purchases', [CoinPackController::class, 'purchases']);
        });

        Route::prefix('creator-wallet')->middleware('creator')->group(function () {
            Route::get('/', [GiftController::class, 'wallet']);
            Route::post('/payouts', [GiftController::class, 'requestPayout']);
            Route::get('/payouts', [GiftController::class, 'payouts']);
        });

        // ── Feed Algorithm ──────────────────────────────────────────
        Route::prefix('feed')->group(function () {
            Route::get('/ranked', [FeedController::class, 'rankedFeed']);
        });

        // ── Link in Bio ──────────────────────────────────────────────
        Route::prefix('link-in-bio')->group(function () {
            Route::get('/', [\App\Http\Controllers\LinkInBioController::class, 'index']);
            Route::post('/', [\App\Http\Controllers\LinkInBioController::class, 'storeLink']);
            Route::patch('/{link}', [\App\Http\Controllers\LinkInBioController::class, 'updateLink']);
            Route::delete('/{link}', [\App\Http\Controllers\LinkInBioController::class, 'destroyLink']);
            Route::put('/profile', [\App\Http\Controllers\LinkInBioController::class, 'saveProfile']);
            Route::get('/design', [\App\Http\Controllers\LinkInBioController::class, 'showDesign']);
            Route::put('/design', [\App\Http\Controllers\LinkInBioController::class, 'updateDesign']);
            Route::post('/design/apply-theme', [\App\Http\Controllers\LinkInBioController::class, 'applyTheme']);
            Route::post('/design/apply-template', [\App\Http\Controllers\LinkInBioController::class, 'applyTemplate']);
            Route::put('/domain', [\App\Http\Controllers\LinkInBioController::class, 'updateDomain']);
            Route::post('/domain/verify', [\App\Http\Controllers\LinkInBioController::class, 'verifyDomain']);
            Route::post('/links/{link}/track-click', [\App\Http\Controllers\LinkInBioController::class, 'trackClick']);

            // Social links
            Route::get('/socials', [\App\Http\Controllers\LinkInBioController::class, 'indexSocials']);
            Route::post('/socials', [\App\Http\Controllers\LinkInBioController::class, 'storeSocial']);
            Route::patch('/socials/{social}', [\App\Http\Controllers\LinkInBioController::class, 'updateSocial']);
            Route::delete('/socials/{social}', [\App\Http\Controllers\LinkInBioController::class, 'destroySocial']);

            // Products
            Route::get('/products', [\App\Http\Controllers\LinkInBioController::class, 'indexProducts']);
            Route::post('/products', [\App\Http\Controllers\LinkInBioController::class, 'storeProduct']);
            Route::patch('/products/{product}', [\App\Http\Controllers\LinkInBioController::class, 'updateProduct']);
            Route::delete('/products/{product}', [\App\Http\Controllers\LinkInBioController::class, 'destroyProduct']);
        });

        // ── Marketing Campaigns ──────────────────────────────────────
        Route::prefix('marketing/campaigns')->middleware('creator')->group(function () {
            Route::get('/', [\App\Http\Controllers\MarketingCampaignController::class, 'index']);
            Route::post('/', [\App\Http\Controllers\MarketingCampaignController::class, 'store']);
            Route::get('/{campaign}', [\App\Http\Controllers\MarketingCampaignController::class, 'show']);
            Route::put('/{campaign}', [\App\Http\Controllers\MarketingCampaignController::class, 'update']);
            Route::delete('/{campaign}', [\App\Http\Controllers\MarketingCampaignController::class, 'destroy']);
        });

        // ── AI Chat ──────────────────────────────────────────────────
        Route::post('/ai/chat', [\App\Http\Controllers\AiChatController::class, 'chat'])->middleware('throttle:30,1');

        // ── AI behavior settings (persona, tone, topic guardrails) ─────
        Route::prefix('ai')->group(function () {
            Route::get('/settings', [\App\Http\Controllers\AiSettingsController::class, 'show']);
            Route::put('/settings', [\App\Http\Controllers\AiSettingsController::class, 'update']);
        });

        // ── AI Onboarding wizard ─────────────────────────────────────
        Route::prefix('onboarding')->group(function () {
            Route::get('/', [\App\Http\Controllers\OnboardingController::class, 'state']);
            Route::get('/config', [\App\Http\Controllers\OnboardingController::class, 'config']);
            Route::post('/progress', [\App\Http\Controllers\OnboardingController::class, 'saveProgress']);
            Route::post('/vendor-info', [\App\Http\Controllers\OnboardingController::class, 'saveVendorInfo']);
            Route::post('/member-setup', [\App\Http\Controllers\OnboardingController::class, 'saveMemberSetup']);
            Route::post('/chat', [\App\Http\Controllers\OnboardingController::class, 'chat'])->middleware('throttle:30,1');
            Route::post('/about', [\App\Http\Controllers\OnboardingController::class, 'saveAbout']);
            Route::post('/interests', [\App\Http\Controllers\OnboardingController::class, 'saveInterests']);
            Route::post('/socials', [\App\Http\Controllers\OnboardingController::class, 'saveSocials']);
            Route::post('/draft-profile', [\App\Http\Controllers\OnboardingController::class, 'draftProfile']);
            Route::post('/setup', [\App\Http\Controllers\OnboardingController::class, 'setup']);
            Route::post('/complete', [\App\Http\Controllers\OnboardingController::class, 'complete']);
        });

        // ── Connected Social Accounts & Follower Intelligence ────────────
        Route::prefix('social-accounts')->group(function () {
            Route::get('/', [\App\Http\Controllers\SocialAccountController::class, 'index']);
            Route::get('/supported-providers', [\App\Http\Controllers\SocialAccountController::class, 'supportedProviders']);
            Route::get('/follower-summary', [\App\Http\Controllers\SocialAccountController::class, 'followerSummary']);
            Route::post('/manual', [\App\Http\Controllers\SocialAccountController::class, 'manualConnect']);
            Route::patch('/{id}', [\App\Http\Controllers\SocialAccountController::class, 'update']);
            Route::delete('/{id}', [\App\Http\Controllers\SocialAccountController::class, 'destroy']);
        });

        // ── Courses ──────────────────────────────────────────────────
        Route::prefix('courses')->middleware('creator')->group(function () {
            Route::get('/', [\App\Http\Controllers\CourseController::class, 'index']);
            Route::post('/', [\App\Http\Controllers\CourseController::class, 'store']);
            Route::get('/{course}', [\App\Http\Controllers\CourseController::class, 'show']);
            Route::put('/{course}', [\App\Http\Controllers\CourseController::class, 'update']);
            Route::delete('/{course}', [\App\Http\Controllers\CourseController::class, 'destroy']);
        });

        // ── Affiliate Products ──────────────────────────────────────
        Route::prefix('affiliate/products')->middleware('creator')->group(function () {
            Route::get('/', [\App\Http\Controllers\AffiliateProductController::class, 'index']);
            Route::post('/', [\App\Http\Controllers\AffiliateProductController::class, 'store']);
            Route::get('/{product}', [\App\Http\Controllers\AffiliateProductController::class, 'show']);
            Route::put('/{product}', [\App\Http\Controllers\AffiliateProductController::class, 'update']);
            Route::delete('/{product}', [\App\Http\Controllers\AffiliateProductController::class, 'destroy']);
        });

        // ── Short Links ──────────────────────────────────────────
        Route::prefix('short-links')->group(function () {
            Route::get('/', [\App\Http\Controllers\ShortLinkController::class, 'index']);
            Route::post('/', [\App\Http\Controllers\ShortLinkController::class, 'store']);
            Route::delete('/{shortLink}', [\App\Http\Controllers\ShortLinkController::class, 'destroy']);
        });

        // ── Community Requests (user's own sent requests) ────────────
        Route::prefix('community-requests')->group(function () {
            Route::get('/', [MembershipController::class, 'myRequests']);
            Route::get('/incoming', [MembershipController::class, 'incomingRequests']);
            Route::post('/{id}/cancel', [MembershipController::class, 'cancelRequest']);
        });

        // ── Friends & Friend Requests ─────────────────────────────────
        Route::prefix('friends')->group(function () {
            Route::get('/', [FriendRequestController::class, 'friends']);
            Route::get('/search', [FriendRequestController::class, 'search']);
            Route::get('/requests', [FriendRequestController::class, 'index']);
            Route::get('/requests/sent', [FriendRequestController::class, 'sent']);
            Route::post('/requests', [FriendRequestController::class, 'send']);
            Route::post('/requests/{id}/accept', [FriendRequestController::class, 'accept']);
            Route::post('/requests/{id}/decline', [FriendRequestController::class, 'decline']);
            Route::post('/requests/{id}/cancel', [FriendRequestController::class, 'cancel']);
            Route::delete('/{userId}', [FriendRequestController::class, 'unfriend']);
        });

        // ── Account & Settings (apiClient) ───────────────────────────
        Route::prefix('settings')->group(function () {
            Route::put('/privacy', [\App\Http\Controllers\ProfileController::class, 'updatePrivacy']);
        });

        Route::prefix('account')->group(function () {
            Route::post('/export', [\App\Http\Controllers\ProfileController::class, 'exportData']);
            Route::delete('/', [\App\Http\Controllers\ProfileController::class, 'deleteAccount']);
        });

        // ── Sprint 1: Role Upgrade / Account Transition ──────────────────
        Route::prefix('role')->group(function () {
            Route::get('/application', [\App\Http\Controllers\RoleUpgradeController::class, 'myApplication']);
            Route::get('/history', [\App\Http\Controllers\RoleUpgradeController::class, 'myHistory']);
            Route::post('/apply', [\App\Http\Controllers\RoleUpgradeController::class, 'apply']);
            Route::delete('/apply', [\App\Http\Controllers\RoleUpgradeController::class, 'cancel']);
        });

        // ── KYC (separate from profile/kyc for frontend compat) ─────
        Route::prefix('kyc')->group(function () {
            Route::get('/status', [KycController::class, 'status']);
            Route::get('/triggers', [KycController::class, 'triggers']);
            Route::post('/submit', [\App\Http\Controllers\ProfileController::class, 'submitKyc']);
            Route::post('/start', [KycController::class, 'start'])->middleware('throttle:kyc.session');
            Route::get('/history', [KycController::class, 'history']);
            Route::get('/callback', [KycController::class, 'callback']);
        });

        // ── Verified badge (blue checkmark) ─────────────────────────
        Route::prefix('verification-badge')->group(function () {
            Route::get('/status', [\App\Http\Controllers\VerificationBadgeController::class, 'status']);
            Route::post('/apply', [\App\Http\Controllers\VerificationBadgeController::class, 'apply'])->middleware('kyc');
            Route::post('/activate', [\App\Http\Controllers\VerificationBadgeController::class, 'activate']);
            Route::post('/renew', [\App\Http\Controllers\VerificationBadgeController::class, 'renew']);
            Route::post('/cancel-auto-renew', [\App\Http\Controllers\VerificationBadgeController::class, 'cancelAutoRenew']);
        });

        // ── Analytics extras ────────────────────────────────────────
        Route::prefix('analytics')->group(function () {
            Route::get('/products', [\App\Http\Controllers\AnalyticsController::class, 'productPerformance']);
            Route::get('/chat-channels', [\App\Http\Controllers\AnalyticsController::class, 'chatChannels']);
            Route::get('/content-planner', [\App\Http\Controllers\AnalyticsController::class, 'contentPlanner']);
            Route::get('/community-activity', [\App\Http\Controllers\AnalyticsController::class, 'communityActivity']);
        });

        // ── Sprint G: Activity Log ──────────────────────────────────────────
        Route::prefix('activity-logs')->group(function () {
            Route::get('/', [ActivityLogController::class, 'index']);
            Route::get('/latest', [ActivityLogController::class, 'latest']);
            Route::get('/types', [ActivityLogController::class, 'types']);
        });

        // ── Sprint G: Content Planner ───────────────────────────────────────
        Route::prefix('content-planner')->middleware('creator')->group(function () {
            Route::get('/', [ContentPlannerController::class, 'index']);
            Route::get('/upcoming', [ContentPlannerController::class, 'upcoming']);
            Route::post('/schedule', [ContentPlannerController::class, 'schedule']);
            Route::post('/{id}/unschedule', [ContentPlannerController::class, 'unschedule']);
        });

        // ── Sprint G: Currency Conversion ───────────────────────────────────
        Route::prefix('currency')->group(function () {
            Route::get('/rates', [CurrencyController::class, 'rates']);
            Route::get('/supported', [CurrencyController::class, 'supported']);
            Route::post('/convert', [CurrencyController::class, 'convert']);
        });

        Route::get('/conversations/stats', [\App\Http\Controllers\ConversationController::class, 'stats']);
        Route::get('/messages/recent-activity', [\App\Http\Controllers\ConversationController::class, 'recentActivity']);
        Route::get('/wallet/overview', [\App\Http\Controllers\WalletController::class, 'overview']);

        // ── Sprint 40: Analytics & AI Tools ────────────────────────────────────
        Route::prefix('analytics')->group(function () {
            Route::get('/overview', [AnalyticsController::class, 'overview']);
            Route::get('/sales-trends', [AnalyticsController::class, 'salesTrends']);
            Route::get('/top-products', [AnalyticsController::class, 'topProducts']);
            Route::get('/ai-suggestions', [AnalyticsController::class, 'aiSuggestions']);
        });

        // ── Sprint 33: Reviews & Disputes ─────────────────────────────────────
        Route::prefix('store/reviews')->group(function () {
            Route::get('/my', [ProductReviewController::class, 'myReviews']);
            Route::post('/', [ProductReviewController::class, 'store']);
            Route::put('/{id}', [ProductReviewController::class, 'update']);
            Route::delete('/{id}', [ProductReviewController::class, 'destroy']);
        });

        Route::prefix('store/disputes')->group(function () {
            Route::get('/', [FulfilmentDisputeController::class, 'index']);
            Route::post('/', [FulfilmentDisputeController::class, 'store']);
            Route::get('/{id}', [FulfilmentDisputeController::class, 'show']);
            Route::put('/{id}/resolve', [FulfilmentDisputeController::class, 'resolve']);
        });

        // ── Sprint 15: Checkout & Orders ───────────────────────────────────
        Route::prefix('checkout')->middleware('verified')->group(function () {
            Route::post('/intent', [CheckoutController::class, 'createIntent']);
            Route::post('/complete-mock', [CheckoutController::class, 'completeMock']);
        });

        Route::prefix('orders')->group(function () {
            Route::get('/mine', [OrderController::class, 'myOrders']);
            Route::get('/sales', [OrderController::class, 'creatorSales']);
            Route::get('/{id}/receipt', [OrderController::class, 'receipt']);
        });

        // ── Sprint 16 & 9: MurihPay Multi-Wallet System ─────────────────────
        Route::prefix('wallet')->middleware('verified')->group(function () {
            Route::get('/', [WalletController::class, 'index']);
            Route::get('/list', [WalletController::class, 'index']);
            Route::get('/type/{type}', [WalletController::class, 'showByType'])->whereIn('type', ['system', 'creator', 'business']);
            Route::post('/deposit', [WalletController::class, 'deposit']);
            Route::post('/internal-transfer', [WalletController::class, 'internalTransfer']);
            Route::post('/fees/preview', [FeeController::class, 'preview']);
            Route::post('/pin/setup', [WalletController::class, 'setupPin']);
            Route::post('/pin/update', [WalletController::class, 'updatePin']);
            Route::post('/pin/verify', [WalletController::class, 'verifyPin']);
            Route::get('/pin/status', [WalletController::class, 'pinStatus']);
            Route::get('/transactions', [WalletController::class, 'transactions']);

            // Transfers
            Route::post('/transfers/send', [TransferController::class, 'send']);
            Route::get('/transfers/sent', [TransferController::class, 'sent']);
            Route::get('/transfers/received', [TransferController::class, 'received']);

            // Donations
            Route::post('/donations/send', [DonationController::class, 'send']);
            Route::get('/donations/sent', [DonationController::class, 'sent']);
            Route::get('/donations/received', [DonationController::class, 'received']);

            // Purchases
            Route::get('/purchases', [PurchaseController::class, 'index']);
            Route::post('/purchases/{id}/download', [PurchaseController::class, 'download']);

            // Withdrawals
            Route::post('/withdrawals', [WithdrawalController::class, 'request'])->middleware('kyc');
            Route::get('/withdrawals', [WithdrawalController::class, 'myRequests']);

            // Escrow (Sprint 29)
            Route::prefix('escrow')->group(function () {
                Route::get('/disputes', [EscrowController::class, 'disputes']);
                Route::post('/disputes/{id}/resolve', [EscrowController::class, 'resolveDispute']);
                Route::post('/{escrowId}/dispute', [EscrowController::class, 'openDispute']);
                Route::get('/', [EscrowController::class, 'index']);
                Route::get('/{id}', [EscrowController::class, 'show']);
                Route::post('/{id}/release', [EscrowController::class, 'release']);
                Route::post('/{id}/refund', [EscrowController::class, 'refund']);
            });
        });

        // ── Sprint 22: Subscriptions & Membership Plans ───────────────────
        Route::prefix('subscriptions')->group(function () {
            Route::get('/plans/public', [SubscriptionPlanController::class, 'indexPublic']);
            Route::get('/plans/my', [SubscriptionPlanController::class, 'myPlans']);
            Route::get('/plans/creator/{creatorId}', [SubscriptionPlanController::class, 'indexForCreator']);
            Route::get('/plans/{id}', [SubscriptionPlanController::class, 'show']);

            // Creator-only plan management
            Route::middleware('creator')->group(function () {
                Route::post('/plans', [SubscriptionPlanController::class, 'store']);
                Route::put('/plans/{id}', [SubscriptionPlanController::class, 'update']);
                Route::delete('/plans/{id}', [SubscriptionPlanController::class, 'destroy']);
            });

            Route::get('/mine', [SubscriptionController::class, 'mySubscriptions']);
            Route::get('/subscribers', [SubscriptionController::class, 'mySubscribers']);
            Route::post('/subscribe', [SubscriptionController::class, 'subscribe'])->middleware('verified');
            Route::post('/{id}/cancel', [SubscriptionController::class, 'cancel']);
            Route::get('/stats', [SubscriptionController::class, 'creatorStats']);
        });

        // ── Sprint 21: Coaching & Booking Services ─────────────────────────
        Route::prefix('coaching')->group(function () {
            Route::get('/services', [CoachingServiceController::class, 'indexPublic']);
            Route::get('/services/{id}', [CoachingServiceController::class, 'show']);

            // Creator-only coaching management
            Route::middleware('creator')->group(function () {
                Route::get('/my-services', [CoachingServiceController::class, 'myServices']);
                Route::post('/services', [CoachingServiceController::class, 'store']);
                Route::put('/services/{id}', [CoachingServiceController::class, 'update']);
                Route::delete('/services/{id}', [CoachingServiceController::class, 'destroy']);

                Route::post('/services/{id}/slots/generate', [CoachingServiceController::class, 'generateSlots']);
                Route::get('/services/{id}/slots', [CoachingServiceController::class, 'slots']);
                Route::delete('/services/{id}/slots/{slotId}', [CoachingServiceController::class, 'deleteSlot']);
            });

            Route::post('/book', [CoachingBookingController::class, 'book'])->middleware('verified');
            Route::get('/my-bookings', [CoachingBookingController::class, 'myBookings']);
            Route::get('/my-sessions', [CoachingBookingController::class, 'mySessions']);
            Route::post('/bookings/{id}/cancel', [CoachingBookingController::class, 'cancel']);
            Route::post('/bookings/{id}/complete', [CoachingBookingController::class, 'complete']);
        });

        // ── Sprint 20: Events ──────────────────────────────────────────────
        Route::prefix('my-events')->group(function () {
            Route::get('/', [EventController::class, 'myEvents']);
            Route::get('/{id}', [EventController::class, 'show']);
        });

        Route::prefix('my-events')->middleware('creator')->group(function () {
            Route::post('/', [EventController::class, 'store']);
            Route::put('/{id}', [EventController::class, 'update']);
            Route::post('/{id}/publish', [EventController::class, 'publish']);
            Route::delete('/{id}', [EventController::class, 'destroy']);
        });

        Route::prefix('events')->group(function () {
            Route::post('/{eventId}/register', [EventController::class, 'register'])->middleware('verified');
            Route::post('/{eventId}/cancel', [EventController::class, 'cancelRegistration']);
            Route::get('/{eventId}/registrations', [EventController::class, 'registrations']);
            Route::post('/{eventId}/check-in', [EventController::class, 'checkIn']);
        });

        Route::get('/my-registrations', [EventController::class, 'myRegistrations']);

        // ── Sprint 23: Audio Rooms ─────────────────────────────────────────
        Route::prefix('audio-rooms')->group(function () {
            Route::get('/', [AudioRoomController::class, 'index']);
            Route::get('/my-rooms', [AudioRoomController::class, 'myRooms']);
            Route::get('/{id}', [AudioRoomController::class, 'show']);

            // Participant actions (all authenticated users)
            Route::post('/{id}/join', [AudioRoomController::class, 'join']);
            Route::post('/{id}/leave', [AudioRoomController::class, 'leave']);
            Route::post('/{id}/raise-hand', [AudioRoomController::class, 'raiseHand']);
            Route::get('/{id}/livekit-token', [AudioRoomController::class, 'livekitToken']);

            // Creator/admin actions
            Route::middleware('creator')->group(function () {
                Route::post('/', [AudioRoomController::class, 'store']);
                Route::put('/{id}', [AudioRoomController::class, 'update']);
                Route::delete('/{id}', [AudioRoomController::class, 'destroy']);
                Route::post('/{id}/start', [AudioRoomController::class, 'start']);
                Route::post('/{id}/end', [AudioRoomController::class, 'end']);
                Route::post('/{id}/users/{userId}/role', [AudioRoomController::class, 'updateRole']);
                Route::post('/{id}/users/{userId}/mute', [AudioRoomController::class, 'toggleMute']);
            });
        });

        // ── Sprint 17: Core Administration (securegate) ────────────────────
        Route::prefix('securegate')->middleware('admin')->group(function () {
            // Dashboard
            Route::get('/dashboard', [AdminDashboardController::class, 'stats']);

            // Users
            Route::prefix('users')->group(function () {
                Route::get('/', [AdminUserController::class, 'index']);
                Route::get('/export', [AdminUserController::class, 'export']);
                Route::get('/{id}', [AdminUserController::class, 'show']);
                Route::post('/{id}/suspend', [AdminUserController::class, 'suspend']);
                Route::post('/{id}/activate', [AdminUserController::class, 'activate']);
                Route::post('/{id}/ban', [AdminUserController::class, 'ban']);
                Route::post('/{id}/impersonate', [AdminUserController::class, 'impersonate']);
            });

            // Admins (admin management — super admin only)
            Route::prefix('admins')->group(function () {
                Route::get('/roles', [AdminManagementController::class, 'roles'])->middleware('admin.permission:admins');
                Route::get('/', [AdminManagementController::class, 'index'])->middleware('admin.permission:admins');
                Route::post('/', [AdminManagementController::class, 'store'])->middleware('admin.permission:admins');
                Route::put('/{id}', [AdminManagementController::class, 'update'])->middleware('admin.permission:admins');
                Route::delete('/{id}', [AdminManagementController::class, 'destroy'])->middleware('admin.permission:admins');
            });

            // Wallets & Double-Entry Ledger
            Route::prefix('wallets')->middleware('admin.permission:wallets')->group(function () {
                Route::get('/', [AdminWalletController::class, 'index']);
                Route::get('/ledger', [AdminWalletController::class, 'ledger']);
                Route::post('/{id}/adjust', [AdminWalletController::class, 'adjust']);
            });

            // Platform Fee Rules
            Route::prefix('fees')->middleware('admin.permission:fees')->group(function () {
                Route::get('/', [AdminFeeController::class, 'index']);
                Route::post('/', [AdminFeeController::class, 'store']);
                Route::put('/{id}', [AdminFeeController::class, 'update']);
                Route::post('/{id}/toggle', [AdminFeeController::class, 'toggle']);
                Route::delete('/{id}', [AdminFeeController::class, 'destroy']);
            });

            // KYC
            Route::prefix('kyc')->group(function () {
                Route::get('/', [AdminKycController::class, 'index']);
                Route::get('/verifications', [AdminKycController::class, 'verifications']);
                Route::get('/{user}', [AdminKycController::class, 'show']);
                Route::post('/{user}/approve', [AdminKycController::class, 'approve']);
                Route::post('/{user}/reject', [AdminKycController::class, 'reject']);
            });

            // ── Sprint 1: Role Applications ──────────────────────────────
            Route::prefix('role-applications')->group(function () {
                Route::get('/', [\App\Http\Controllers\RoleUpgradeController::class, 'adminIndex']);
                Route::get('/stats', [\App\Http\Controllers\RoleUpgradeController::class, 'stats']);
                Route::get('/{id}', [\App\Http\Controllers\RoleUpgradeController::class, 'adminShow']);
                Route::patch('/{id}/approve', [\App\Http\Controllers\RoleUpgradeController::class, 'approve']);
                Route::patch('/{id}/reject', [\App\Http\Controllers\RoleUpgradeController::class, 'reject']);
            });

            // ── Sprint 2: Verification Badges ───────────────────────────
            Route::prefix('verification-badges')->group(function () {
                Route::get('/', [\App\Http\Controllers\VerificationBadgeController::class, 'adminIndex']);
                Route::patch('/{userId}/status', [\App\Http\Controllers\VerificationBadgeController::class, 'adminUpdateStatus']);
            });

            // Withdrawals
            Route::prefix('withdrawals')->group(function () {
                Route::get('/', [WithdrawalController::class, 'adminIndex']);
                Route::post('/{id}/process', [WithdrawalController::class, 'adminProcess']);
            });

            // Reports
            Route::prefix('reports')->group(function () {
                Route::get('/', [ModerationController::class, 'index']);
                Route::get('/pending-count', [ModerationController::class, 'pendingCount']);
                Route::post('/{report}/action', [ModerationController::class, 'action']);
            });

            // Orders
            Route::get('/orders', [OrderController::class, 'adminIndex']);

            // Audit Logs
            Route::prefix('audit-logs')->group(function () {
                Route::get('/', [AuditLogController::class, 'index']);
                Route::get('/{id}', [AuditLogController::class, 'show']);
            });

            // Reconciliation (Sprint 29)
            Route::prefix('reconciliation')->group(function () {
                Route::get('/audit', [ReconciliationController::class, 'audit']);
                Route::get('/ledger-summary', [ReconciliationController::class, 'ledgerSummary']);
            });

            // Feature Flags
            Route::prefix('feature-flags')->group(function () {
                Route::get('/', [FeatureFlagController::class, 'index']);
                Route::post('/', [FeatureFlagController::class, 'store']);
                Route::put('/{id}', [FeatureFlagController::class, 'update']);
                Route::post('/{id}/toggle', [FeatureFlagController::class, 'toggle']);
                Route::delete('/{id}', [FeatureFlagController::class, 'destroy']);
            });

            // ── Sprint 19: Queue & System Monitoring ─────────────────────────
            Route::prefix('queue')->group(function () {
                Route::get('/health', [\App\Http\Controllers\QueueMonitorController::class, 'health']);
                Route::get('/stats', [\App\Http\Controllers\QueueMonitorController::class, 'stats']);
                Route::get('/failed-jobs', [\App\Http\Controllers\QueueMonitorController::class, 'failedJobs']);
                Route::post('/failed-jobs/{id}/retry', [\App\Http\Controllers\QueueMonitorController::class, 'retryFailed']);
                Route::post('/failed-jobs/retry-all', [\App\Http\Controllers\QueueMonitorController::class, 'retryAllFailed']);
                Route::delete('/failed-jobs', [\App\Http\Controllers\QueueMonitorController::class, 'flushFailed']);
                Route::get('/system-info', [\App\Http\Controllers\QueueMonitorController::class, 'systemInfo']);
            });

            // ── Sprint 20: Events Management ──────────────────────────────────
            Route::prefix('events')->group(function () {
                Route::get('/', [EventController::class, 'adminIndex']);
            });

            // ── Sprint 18: CMS Page Sections ─────────────────────────────────
            Route::prefix('cms')->group(function () {
                Route::get('/', [PageSectionController::class, 'index']);
                Route::post('/', [PageSectionController::class, 'store']);
                Route::get('/{id}', [PageSectionController::class, 'show']);
                Route::put('/{id}', [PageSectionController::class, 'update']);
                Route::delete('/{id}', [PageSectionController::class, 'destroy']);
                Route::post('/reorder', [PageSectionController::class, 'reorder']);
            });

            // ── Sprint 33: Disputes Management ────────────────────────────────
            Route::prefix('disputes')->group(function () {
                Route::get('/', [FulfilmentDisputeController::class, 'adminIndex']);
                Route::put('/{id}/resolve', [FulfilmentDisputeController::class, 'adminResolve']);
                Route::get('/brand-deals', [BrandDealMilestoneController::class, 'adminDisputesIndex']);
                Route::post('/brand-deals/{milestoneId}/resolve', [BrandDealMilestoneController::class, 'adminResolveDispute']);
            });

            // ── Sprint 35: Payouts Management ─────────────────────────────────
            Route::prefix('payouts')->group(function () {
                Route::get('/', [FulfilmentPayoutController::class, 'adminIndex']);
            });

            // ── Sprint 36: Badges Management ──────────────────────────────────
            Route::prefix('badges')->group(function () {
                Route::post('/', [BadgeController::class, 'store']);
                Route::put('/{id}', [BadgeController::class, 'update']);
                Route::delete('/{id}', [BadgeController::class, 'destroy']);
                Route::post('/seed', [BadgeController::class, 'seed']);
            });

            // ── Sprint 33: Reviews Management (admin-only) ─────────────────────
            Route::prefix('reviews')->group(function () {
                Route::get('/', [ProductReviewController::class, 'adminIndex']);
                Route::put('/{id}', [ProductReviewController::class, 'adminUpdate']);
                Route::post('/{id}/approve', [ProductReviewController::class, 'adminApprove']);
                Route::delete('/{id}', [ProductReviewController::class, 'adminDestroy']);
            });

            // ── Sprint 41: Communities Management ────────────────────────────
            Route::prefix('communities')->group(function () {
                Route::get('/', [CommunityController::class, 'adminIndex']);
                Route::get('/{id}', [CommunityController::class, 'adminShow']);
                Route::delete('/{id}', [CommunityController::class, 'adminDelete']);
            });

            // ── Sprint 41: Escrow Management ─────────────────────────────────
            Route::prefix('escrow')->group(function () {
                Route::get('/', [EscrowController::class, 'index']);
                Route::get('/{id}', [EscrowController::class, 'show']);
                Route::post('/{id}/release', [EscrowController::class, 'release']);
                Route::post('/{id}/refund', [EscrowController::class, 'refund']);
                Route::post('/{id}/disputes', [EscrowController::class, 'openDispute']);
                Route::get('/disputes', [EscrowController::class, 'disputes']);
                Route::put('/disputes/{id}/resolve', [EscrowController::class, 'resolveDispute']);
            });

            // ── Sprint 41: Payouts Management ────────────────────────────────
            Route::prefix('payouts')->group(function () {
                Route::get('/', [FulfilmentPayoutController::class, 'adminIndex']);
                Route::put('/{id}/mark-paid', [FulfilmentPayoutController::class, 'adminMarkPaid']);
            });

            // ── Sprint 42: Platform Analytics ────────────────────────────────
            Route::prefix('analytics')->group(function () {
                Route::get('/overview', [AdminAnalyticsController::class, 'overview']);
                Route::get('/trends', [AdminAnalyticsController::class, 'trends']);
                Route::get('/top-content', [AdminAnalyticsController::class, 'topContent']);
                Route::get('/growth', [AdminAnalyticsController::class, 'growth']);
                Route::get('/revenue', [AdminAnalyticsController::class, 'revenue']);
                Route::get('/pending-counts', [AdminAnalyticsController::class, 'pendingCounts']);
            });

            // ── Sprint 42: Plans & Fees Management ───────────────────────────
            Route::prefix('plans')->group(function () {
                Route::get('/', [AdminPlansController::class, 'index']);
                Route::get('/{id}', [AdminPlansController::class, 'show']);
                Route::post('/{id}/toggle', [AdminPlansController::class, 'toggleActive']);
            });

            // ── System Health ────────────────────────────────────────────────
            Route::get('/system-health', [\App\Http\Controllers\AdminSystemHealthController::class, 'index']);

            // ── Moderation Logs ─────────────────────────────────────────────
            Route::get('/moderation-logs', [\App\Http\Controllers\AdminModerationLogController::class, 'index']);

            // ── Audit Trail ─────────────────────────────────────────────────
            Route::prefix('audit-trail')->group(function () {
                Route::get('/', [\App\Http\Controllers\AuditLogController::class, 'index']);
            });

            // ── Admin Settings ──────────────────────────────────────────────
            Route::prefix('settings')->group(function () {
                Route::get('/', [\App\Http\Controllers\AdminSettingsController::class, 'show']);
                Route::put('/', [\App\Http\Controllers\AdminSettingsController::class, 'update']);
            });

            // ── AI Provider Selection ───────────────────────────────────────
            Route::prefix('ai-settings')->group(function () {
                Route::get('/', [\App\Http\Controllers\AdminAiSettingsController::class, 'show']);
                Route::put('/', [\App\Http\Controllers\AdminAiSettingsController::class, 'update']);
                Route::post('/test', [\App\Http\Controllers\AdminAiSettingsController::class, 'test']);
            });

            // ── Mail Engine & Email Templates ───────────────────────────────
            Route::prefix('mail-settings')->group(function () {
                Route::get('/', [\App\Http\Controllers\AdminMailSettingsController::class, 'show']);
                Route::put('/', [\App\Http\Controllers\AdminMailSettingsController::class, 'update']);
                Route::post('/test', [\App\Http\Controllers\AdminMailSettingsController::class, 'test']);
            });

            // ── SMS Engine ─────────────────────────────────────────────────
            Route::prefix('sms-settings')->group(function () {
                Route::get('/', [\App\Http\Controllers\AdminSmsSettingsController::class, 'show']);
                Route::put('/', [\App\Http\Controllers\AdminSmsSettingsController::class, 'update']);
                Route::post('/test', [\App\Http\Controllers\AdminSmsSettingsController::class, 'test']);
            });

            // ── Social Login (OAuth) Providers ──────────────────────────────
            Route::prefix('social-login')->group(function () {
                Route::get('/', [\App\Http\Controllers\AdminSocialLoginController::class, 'show']);
                Route::put('/', [\App\Http\Controllers\AdminSocialLoginController::class, 'update']);
            });

            // ── Authentication Methods ──────────────────────────────────────
            Route::prefix('auth')->middleware('admin.permission:settings')->group(function () {
                Route::get('/methods', [\App\Http\Controllers\AdminAuthMethodController::class, 'show']);
                Route::put('/methods', [\App\Http\Controllers\AdminAuthMethodController::class, 'update']);
            });

            // ── Server Media Retention ─────────────────────────────────────
            Route::prefix('messaging-retention')->middleware('admin.permission:settings')->group(function () {
                Route::get('/', [\App\Http\Controllers\AdminMediaRetentionController::class, 'show']);
                Route::put('/', [\App\Http\Controllers\AdminMediaRetentionController::class, 'update']);
                Route::post('/run', [\App\Http\Controllers\AdminMediaRetentionController::class, 'runNow']);
                Route::get('/holds', [\App\Http\Controllers\AdminMediaRetentionController::class, 'holds']);
                Route::post('/holds', [\App\Http\Controllers\AdminMediaRetentionController::class, 'placeHold']);
                Route::delete('/holds/{hold}', [\App\Http\Controllers\AdminMediaRetentionController::class, 'releaseHold']);
                Route::get('/logs', [\App\Http\Controllers\AdminMediaRetentionController::class, 'logs']);
            });

            // ── Creator Qualification Settings & Events ─────────────────────
            Route::prefix('creator-qualification')->group(function () {
                Route::get('/settings', [\App\Http\Controllers\AdminSettingsController::class, 'getCreatorQualification']);
                Route::put('/settings', [\App\Http\Controllers\AdminSettingsController::class, 'updateCreatorQualification']);
                Route::get('/events', [\App\Http\Controllers\AdminSettingsController::class, 'listQualificationEvents']);
                Route::post('/events/{id}/notify', [\App\Http\Controllers\AdminSettingsController::class, 'notifyQualificationEvent']);
                Route::get('/accounts', [\App\Http\Controllers\AdminSettingsController::class, 'listSocialAccounts']);
            });

            Route::prefix('email-templates')->group(function () {
                Route::get('/', [\App\Http\Controllers\AdminEmailTemplateController::class, 'index']);
                Route::get('{key}', [\App\Http\Controllers\AdminEmailTemplateController::class, 'show']);
                Route::put('{key}', [\App\Http\Controllers\AdminEmailTemplateController::class, 'update']);
                Route::post('{key}/reset', [\App\Http\Controllers\AdminEmailTemplateController::class, 'reset']);
            });

            // ── Storage Configuration ───────────────────────────────────────
            Route::prefix('storage')->group(function () {
                Route::get('/', [AdminStorageController::class, 'show']);
                Route::put('/', [AdminStorageController::class, 'update']);

                Route::prefix('providers')->group(function () {
                    Route::get('/', [\App\Http\Controllers\AdminObjectStorageProviderController::class, 'index']);
                    Route::post('/', [\App\Http\Controllers\AdminObjectStorageProviderController::class, 'store']);
                    Route::get('{provider}', [\App\Http\Controllers\AdminObjectStorageProviderController::class, 'show']);
                    Route::put('{provider}', [\App\Http\Controllers\AdminObjectStorageProviderController::class, 'update']);
                    Route::delete('{provider}', [\App\Http\Controllers\AdminObjectStorageProviderController::class, 'destroy']);
                });
            });

            // ── Advertisements Management ──────────────────────────────────
            Route::prefix('ads')->group(function () {
                Route::get('/', [AdminAdController::class, 'index']);
                Route::get('/stats', [AdminAdController::class, 'stats']);
                Route::get('/revenue', [AdminAdController::class, 'revenue']);
                Route::post('/{id}/approve', [AdminAdController::class, 'approve']);
                Route::post('/{id}/reject', [AdminAdController::class, 'reject']);
                Route::post('/{id}/suspend', [AdminAdController::class, 'suspend']);
                Route::delete('/{id}', [AdminAdController::class, 'remove']);
            });

            // ── Gifts Management ──────────────────────────────────────────
            Route::prefix('gifts')->group(function () {
                Route::get('/', [GiftController::class, 'adminGifts']);
                Route::post('/', [GiftController::class, 'adminStoreGift']);
                Route::put('/{id}', [GiftController::class, 'adminUpdateGift']);
                Route::delete('/{id}', [GiftController::class, 'adminDeleteGift']);
                Route::post('/reorder', [GiftController::class, 'adminReorderGifts']);
                Route::get('/stats', [GiftController::class, 'adminStats']);
                Route::post('/users/{userId}/toggle-gifting', [GiftController::class, 'adminToggleGifting']);
            });

            // ── Gift Payouts Management ───────────────────────────────────
            Route::prefix('gift-payouts')->group(function () {
                Route::get('/', [GiftController::class, 'adminPayouts']);
                Route::post('/{id}/approve', [GiftController::class, 'adminApprovePayout']);
                Route::post('/{id}/reject', [GiftController::class, 'adminRejectPayout']);
                Route::post('/{id}/mark-paid', [GiftController::class, 'adminMarkPaid']);
            });

            // ── Coin Packs Management ─────────────────────────────────────
            Route::prefix('coin-packs')->group(function () {
                Route::get('/', [CoinPackController::class, 'adminIndex']);
                Route::post('/', [CoinPackController::class, 'adminStore']);
                Route::put('/{id}', [CoinPackController::class, 'adminUpdate']);
                Route::delete('/{id}', [CoinPackController::class, 'adminDelete']);
                Route::post('/reorder', [CoinPackController::class, 'adminReorder']);
            });

            // ── Feed Algorithm Management ─────────────────────────────────
            Route::prefix('feed-algorithm')->group(function () {
                Route::get('/weights', [FeedController::class, 'weights']);
                Route::put('/weights/{id}', [FeedController::class, 'updateWeight']);
                Route::get('/configs', [FeedController::class, 'configs']);
                Route::put('/configs/{id}', [FeedController::class, 'updateConfig']);
                Route::post('/configs/{id}/promote', [FeedController::class, 'promoteToProduction']);
                Route::post('/configs/{id}/rollback', [FeedController::class, 'rollback']);
                Route::get('/boosts', [FeedController::class, 'boosts']);
                Route::post('/boosts', [FeedController::class, 'storeBoost']);
                Route::delete('/boosts/{id}', [FeedController::class, 'removeBoost']);
                Route::get('/changes', [FeedController::class, 'changes']);
                Route::post('/seed', [FeedController::class, 'seedDefaultWeights']);
                Route::get('/ab-tests', [FeedController::class, 'abTests']);
                Route::post('/ab-tests', [FeedController::class, 'storeAbTest']);
                Route::post('/ab-tests/{id}/start', [FeedController::class, 'startAbTest']);
                Route::post('/ab-tests/{id}/end', [FeedController::class, 'endAbTest']);
            });

            // ── Story Settings ─────────────────────────────────────────────
            Route::prefix('stories')->group(function () {
                Route::get('/settings', [\App\Http\Controllers\AdminStoryController::class, 'show']);
                Route::put('/settings', [\App\Http\Controllers\AdminStoryController::class, 'update']);
            });

            // ── Conversion Metrics ─────────────────────────────────────────
            Route::get('/analytics/conversions', [\App\Http\Controllers\AdminConversionMetricsController::class, 'index']);
        });
    });
});
