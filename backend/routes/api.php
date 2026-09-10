<?php

use App\Http\Controllers\ActivityLogController;
use App\Http\Controllers\AdController;
use App\Http\Controllers\AdsSsoController;
use App\Http\Controllers\AddressController;
use App\Http\Controllers\AdminAccountingController;
use App\Http\Controllers\AdminAdController;
use App\Http\Controllers\AdminAiSettingsController;
use App\Http\Controllers\AdminAnalyticsController;
use App\Http\Controllers\AdminAuthMethodController;
use App\Http\Controllers\AdminConversionMetricsController;
use App\Http\Controllers\AdminDashboardController;
use App\Http\Controllers\AdminEmailTemplateController;
use App\Http\Controllers\AdminFeeController;
use App\Http\Controllers\AdminKycController;
use App\Http\Controllers\AdminMailSettingsController;
use App\Http\Controllers\AdminManagementController;
use App\Http\Controllers\AdminMediaController;
use App\Http\Controllers\AdminMediaRetentionController;
use App\Http\Controllers\AdminModerationLogController;
use App\Http\Controllers\AdminObjectStorageProviderController;
use App\Http\Controllers\AdminPaymentProviderController;
use App\Http\Controllers\AdminPaymentTransactionController;
use App\Http\Controllers\AdminPlansController;
use App\Http\Controllers\AdminSettingsController;
use App\Http\Controllers\AdminSmsSettingsController;
use App\Http\Controllers\AdminSocialLoginController;
use App\Http\Controllers\AdminStorageController;
use App\Http\Controllers\AdminStoryController;
use App\Http\Controllers\AdminSystemHealthController;
use App\Http\Controllers\AdminTaxController;
use App\Http\Controllers\AdminUserController;
use App\Http\Controllers\AdminWalletController;
use App\Http\Controllers\AffiliateProductController;
use App\Http\Controllers\AiChatController;
use App\Http\Controllers\AiSettingsController;
use App\Http\Controllers\AnalyticsController;
use App\Http\Controllers\AudioRoomController;
use App\Http\Controllers\AuditLogController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\AuthMethodConfigController;
use App\Http\Controllers\BadgeController;
use App\Http\Controllers\BlockController;
use App\Http\Controllers\BrandController;
use App\Http\Controllers\BrandDealController;
use App\Http\Controllers\BrandDealMilestoneController;
use App\Http\Controllers\BrandDealProposalController;
use App\Http\Controllers\BrandInvoiceController;
use App\Http\Controllers\CartController;
use App\Http\Controllers\ChatMediaController;
use App\Http\Controllers\ChatRoomController;
use App\Http\Controllers\CheckoutController;
use App\Http\Controllers\CoachingBookingController;
use App\Http\Controllers\CoachingServiceController;
use App\Http\Controllers\CoinPackController;
use App\Http\Controllers\CommunityController;
use App\Http\Controllers\ContentItemController;
use App\Http\Controllers\ContentPlannerController;
use App\Http\Controllers\ConversationController;
use App\Http\Controllers\ConversationSettingsController;
use App\Http\Controllers\CountryController;
use App\Http\Controllers\CourseController;
use App\Http\Controllers\CurrencyController;
use App\Http\Controllers\DigitalProductController;
use App\Http\Controllers\DonationController;
use App\Http\Controllers\EmailBroadcastController;
use App\Http\Controllers\EmailSequenceController;
use App\Http\Controllers\EscrowController;
use App\Http\Controllers\EventController;
use App\Http\Controllers\FeatureFlagController;
use App\Http\Controllers\FeeController;
use App\Http\Controllers\FeedController;
use App\Http\Controllers\FollowController;
use App\Http\Controllers\FriendRequestController;
use App\Http\Controllers\FulfilmentDisputeController;
use App\Http\Controllers\FulfilmentOrderController;
use App\Http\Controllers\FulfilmentPayoutController;
use App\Http\Controllers\GiftController;
use App\Http\Controllers\GroupChatController;
use App\Http\Controllers\GroupController;
use App\Http\Controllers\GroupInvitationController;
use App\Http\Controllers\GroupMemberController;
use App\Http\Controllers\GroupPostController;
use App\Http\Controllers\GroupSettingsController;
use App\Http\Controllers\InternalAccountingSyncController;
use App\Http\Controllers\KycController;
use App\Http\Controllers\LinkInBioController;
use App\Http\Controllers\LiveStreamController;
use App\Http\Controllers\MarketingCampaignController;
use App\Http\Controllers\MarketplaceController;
use App\Http\Controllers\MediaKitController;
use App\Http\Controllers\MembershipController;
use App\Http\Controllers\MessageAttachmentController;
use App\Http\Controllers\MessageReactionController;
use App\Http\Controllers\MilestoneController;
use App\Http\Controllers\ModerationController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\NotificationPreferenceController;
use App\Http\Controllers\OnboardingController;
use App\Http\Controllers\OrderController;
use App\Http\Controllers\PageSectionController;
use App\Http\Controllers\PasswordResetController;
use App\Http\Controllers\PaymentController;
use App\Http\Controllers\PaymentWebhookController;
use App\Http\Controllers\PhoneOtpController;
use App\Http\Controllers\PhoneVerificationController;
use App\Http\Controllers\PhysicalProductController;
use App\Http\Controllers\PlatformController;
use App\Http\Controllers\PostController;
use App\Http\Controllers\ProductReviewController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\PurchaseController;
use App\Http\Controllers\PushTokenController;
use App\Http\Controllers\QueueMonitorController;
use App\Http\Controllers\ReactionController;
use App\Http\Controllers\ReconciliationController;
use App\Http\Controllers\ReferralController;
use App\Http\Controllers\RoleController;
use App\Http\Controllers\RoleUpgradeController;
use App\Http\Controllers\SearchController;
use App\Http\Controllers\ShippingProfileController;
use App\Http\Controllers\ShortLinkController;
use App\Http\Controllers\SocialAccountController;
use App\Http\Controllers\SocialAuthController;
use App\Http\Controllers\SoundTrackController;
use App\Http\Controllers\StoreCategoryController;
use App\Http\Controllers\StorefrontController;
use App\Http\Controllers\StoreInventoryController;
use App\Http\Controllers\StoreMembershipPlanController;
use App\Http\Controllers\StorePostController;
use App\Http\Controllers\StoreReturnController;
use App\Http\Controllers\StoreSettingsController;
use App\Http\Controllers\StoryController;
use App\Http\Controllers\SubscriptionController;
use App\Http\Controllers\SubscriptionPlanController;
use App\Http\Controllers\SupportController;
use App\Http\Controllers\TicketProxyController;
use App\Http\Controllers\TransferController;
use App\Http\Controllers\UploadController;
use App\Http\Controllers\VerificationBadgeController;
use App\Http\Controllers\VerificationController;
use App\Http\Controllers\WalletController;
use App\Http\Controllers\WithdrawalController;
use App\Services\Kyc\KycProviderManager;
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
    Route::post('/webhooks/sumsub', fn (Request $r) => app(KycController::class)->webhook($r, app(KycProviderManager::class), 'sumsub'))->middleware('throttle:30,1');

    // Didit KYC webhook (public, signature-verified)
    Route::post('/webhooks/didit', fn (Request $r) => app(KycController::class)->webhook($r, app(KycProviderManager::class), 'didit'))->middleware('throttle:30,1');

    // Dedicated Webhooks for Airwallex, Paystack, Flutterwave
    Route::post('/webhooks/airwallex', [PaymentWebhookController::class, 'airwallex'])->middleware('throttle:60,1');
    Route::post('/webhooks/paystack', [PaymentWebhookController::class, 'paystack'])->middleware('throttle:60,1');
    Route::post('/webhooks/flutterwave', [PaymentWebhookController::class, 'flutterwave'])->middleware('throttle:60,1');

    // Internal Services Accounting Synchronization (web/ads-backend -> web/backend)
    Route::post('/internal/accounting/sync-ad-revenue', [InternalAccountingSyncController::class, 'syncAdRevenue'])->middleware('throttle:120,1');

    // Payment Engine
    Route::get('/payments/methods', [PaymentController::class, 'methods']);
    Route::get('/payments/{reference}/status', [PaymentController::class, 'status']);
    Route::post('/payments/initialize', [PaymentController::class, 'initialize'])->middleware('auth:sanctum');

    // Public platform config (used by login/registration + app-lock screens)
    Route::get('/platform', [PlatformController::class, 'config'])->middleware('cache.public:30');

    // Authentication Routes
    Route::prefix('auth')->group(function () {
        Route::post('/register', [AuthController::class, 'register'])->middleware('throttle:auth');
        Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:auth');
        Route::get('/check-username/{username}', [AuthController::class, 'checkUsername'])->middleware('throttle:60,1');

        // Public authentication-method config (no secrets) used to render login/registration.
        Route::get('/methods', [AuthMethodConfigController::class, 'publicConfig'])
            ->middleware('cache.public:30');

        // Phone OTP verification (Twilio Verify in production).
        Route::prefix('otp')->group(function () {
            Route::post('/request', [PhoneOtpController::class, 'request'])->middleware('throttle:otp');
            Route::post('/verify', [PhoneOtpController::class, 'verify'])->middleware('throttle:otp');
        });

        // Password Reset
        Route::post('/forgot-password', [PasswordResetController::class, 'forgotPassword'])->middleware('throttle:auth');
        Route::post('/reset-password', [PasswordResetController::class, 'resetPassword'])->middleware('throttle:auth');

        // Social Auth
        Route::prefix('social')->group(function () {
            Route::get('/{provider}/redirect', [SocialAuthController::class, 'redirect']);
            Route::match(['get', 'post'], '/{provider}/callback', [SocialAuthController::class, 'callback']);
        });

        // Device approval status check (Public for Device B)
        Route::get('/device-approval/check-status/{token}', [AuthController::class, 'checkDeviceLoginStatus']);

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

            // Device Approval & Sessions
            Route::get('/device-approval/pending', [AuthController::class, 'pendingLoginRequests']);
            Route::post('/device-approval/{id}/approve', [AuthController::class, 'approveDeviceLogin']);
            Route::post('/device-approval/{id}/deny', [AuthController::class, 'denyDeviceLogin']);
            Route::get('/sessions', [AuthController::class, 'sessions']);
            Route::delete('/sessions/{id}', [AuthController::class, 'destroySession']);
            Route::post('/sessions/revoke-all-others', [AuthController::class, 'revokeAllOtherSessions']);

            // Verified Mobile Number Change
            Route::post('/phone/change-request', [PhoneVerificationController::class, 'requestChange'])->middleware('throttle:otp');
            Route::post('/phone/verify-change', [PhoneVerificationController::class, 'verifyChange'])->middleware('throttle:otp');
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

    // Public User Profile Endpoint
    Route::get('/users/{username}/public', [ProfileController::class, 'publicProfile'])->middleware('cache.public:10');
    Route::get('/users/{username}/reviews', [ProductReviewController::class, 'userReviews']);

    // Public Link-in-Bio Page
    Route::get('/l/{username}', [LinkInBioController::class, 'publicPage'])->middleware('cache.public:10');

    // Link in Bio Click Redirect (public)
    Route::get('/l/click/{linkId}', [LinkInBioController::class, 'redirectClick'])->middleware('throttle:60,1');

    // Affiliate Product Click Redirect (public)
    Route::get('/l/affiliate/{product}', [AffiliateProductController::class, 'redirectClick'])->middleware('throttle:60,1');

    // Short Link Redirect (public)
    Route::get('/s/{code}', [ShortLinkController::class, 'redirect'])->middleware('throttle:60,1');
    Route::get('/public/products/{slug}', [DigitalProductController::class, 'publicShow']);

    // Sprint 15: Public payment webhook (no auth — provider calls this)
    Route::post('/checkout/webhooks/{provider}', [CheckoutController::class, 'handleWebhook'])->middleware('throttle:30,1');

    // Sprint 20: Public Event Endpoints
    Route::prefix('events')->middleware('throttle:60,1')->group(function () {
        Route::get('/', [EventController::class, 'index']);
        Route::get('/{id}', [EventController::class, 'show']);
    });

    // Marketplace Public Endpoints
    Route::get('/marketplace', [MarketplaceController::class, 'index']);
    Route::get('/marketplace/categories', [MarketplaceController::class, 'categories']);
    Route::get('/marketplace/{id}', [MarketplaceController::class, 'show']);

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
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'username' => $user->username,
                'role' => $user->role,
                'bio' => $user->bio,
                'avatar' => $user->avatar,
                'avatar_url' => $user->avatar_url ?? $user->avatar,
                'banner_url' => $user->banner_url,
                'mobile_number' => $user->mobile_number,
                'phone' => $user->mobile_number,
                'birthday' => $user->birthday?->format('Y-m-d'),
                'country' => $user->country,
                'county' => $user->county,
                'state' => $user->state,
                'permissions' => $user->permissions(),
                'kyc_status' => $user->kyc_status,
                'email_verified' => $user->hasVerifiedEmail(),
                'posts_count' => $user->posts()->count(),
                'followers_count' => $user->followers()->count(),
                'following_count' => $user->follows()->count(),
                'communities_count' => $user->communities()->count(),
                'coins' => $user->wallet?->coin_balance ?? 0,
                'verification_badge' => [
                    'status' => $user->verification_badge_status,
                    'active' => $user->hasActiveVerificationBadge(),
                    'expires_at' => $user->verification_badge_expires_at?->toIso8601String(),
                ],
            ]);
        });

        // ── Social Follows & User Relations ──────────────────────────────
        Route::prefix('users/{id}')->group(function () {
            Route::post('/follow', [FollowController::class, 'toggleFollow']);
            Route::post('/follow-user', [FollowController::class, 'follow']);
            Route::delete('/follow', [FollowController::class, 'unfollow']);
            Route::get('/follow-status', [FollowController::class, 'status']);
            Route::get('/followers', [FollowController::class, 'followers']);
            Route::get('/following', [FollowController::class, 'following']);
        });

        // Feature flags (read-only for all authenticated users)
        Route::get('/feature-flags', [FeatureFlagController::class, 'index']);

        // ── File Uploads & Central Media Processing ──────────────────────
        Route::prefix('upload')->group(function () {
            Route::get('/', [UploadController::class, 'index']);
            Route::post('/', [UploadController::class, 'store']);
            Route::delete('/{media}', [UploadController::class, 'destroy']);
        });

        Route::prefix('media')->group(function () {
            Route::get('/', [UploadController::class, 'index']);
            Route::post('/signed-upload-url', [UploadController::class, 'createSignedUploadUrl']);
            Route::post('/complete', [UploadController::class, 'completeUpload']);
            Route::get('/{uuid}', [UploadController::class, 'showByUuid']);
            Route::get('/{uuid}/status', [UploadController::class, 'statusByUuid']);
            Route::post('/{uuid}/retry', [UploadController::class, 'retryProcessing']);
            Route::delete('/{uuid}', [UploadController::class, 'destroy']);
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

        // Groups Feature (Social Feed, Real-time Chat, Moderation, Invites)
        Route::prefix('groups')->group(function () {
            Route::get('/', [GroupController::class, 'index']);
            Route::get('/mine', [GroupController::class, 'mine']);
            Route::get('/invitations', [GroupController::class, 'invitations']);
            Route::post('/', [GroupController::class, 'store']);
            Route::post('/invitations/{code}/accept-by-code', [GroupInvitationController::class, 'acceptByCode']);
            Route::post('/invitations/{id}/respond', [GroupInvitationController::class, 'respond']);

            Route::prefix('{group}')->group(function () {
                Route::get('/', [GroupController::class, 'show']);
                Route::put('/', [GroupController::class, 'update']);
                Route::delete('/', [GroupController::class, 'destroy']);
                Route::post('/join', [GroupController::class, 'join']);
                Route::post('/leave', [GroupController::class, 'leave']);

                // Member management & moderation
                Route::get('/members', [GroupMemberController::class, 'index']);
                Route::put('/members/{memberId}/role', [GroupMemberController::class, 'updateRole']);
                Route::post('/members/{memberId}/mute', [GroupMemberController::class, 'mute']);
                Route::delete('/members/{memberId}', [GroupMemberController::class, 'remove']);
                Route::get('/join-requests', [GroupMemberController::class, 'joinRequests']);
                Route::post('/join-requests/{requestId}/review', [GroupMemberController::class, 'reviewJoinRequest']);

                // Invitations & Links
                Route::post('/invitations', [GroupInvitationController::class, 'invite']);
                Route::get('/invite-link', [GroupInvitationController::class, 'getOrCreateInviteLink']);

                // Group Feed
                Route::get('/posts', [GroupPostController::class, 'index']);
                Route::post('/posts', [GroupPostController::class, 'store']);
                Route::post('/posts/{post}/pin', [GroupPostController::class, 'togglePin']);
                Route::delete('/posts/{post}', [GroupPostController::class, 'destroy']);

                // Real-time Chat
                Route::get('/chat', [GroupChatController::class, 'conversation']);
                Route::get('/chat/messages', [GroupChatController::class, 'messages']);
                Route::post('/chat/messages', [GroupChatController::class, 'sendMessage']);

                // Settings
                Route::get('/settings', [GroupSettingsController::class, 'show']);
                Route::put('/settings', [GroupSettingsController::class, 'update']);
            });
        });

        // Community Actions
        Route::prefix('communities/{id}')->group(function () {
            Route::post('/join', [MembershipController::class, 'join']);
            Route::post('/leave', [MembershipController::class, 'leave']);
            Route::get('/membership-status', [MembershipController::class, 'status']);
            Route::get('/members', [MembershipController::class, 'members']);
            Route::get('/requests', [MembershipController::class, 'pendingRequests']);
            Route::get('/gifts', [GiftController::class, 'communityGifts']);
            Route::delete('/members/{userId}', [MembershipController::class, 'removeMember']);
            Route::put('/members/{userId}/role', [MembershipController::class, 'updateMemberRole']);
            Route::post('/roles', [RoleController::class, 'store']);
        });

        // Sound & Music Library for Live Streams & Audio Rooms
        Route::get('/sound-tracks', [SoundTrackController::class, 'index']);

        // Membership Approval / Rejection
        Route::prefix('memberships/{id}')->group(function () {
            Route::post('/approve', [MembershipController::class, 'approve']);
            Route::post('/reject', [MembershipController::class, 'reject']);
        });

        // Posts, Comments & Reactions
        Route::prefix('posts')->group(function () {
            Route::post('/', [PostController::class, 'store']);
            Route::get('/saved', [PostController::class, 'savedPosts']);
            Route::put('/{id}', [PostController::class, 'update']);
            Route::delete('/{id}', [PostController::class, 'destroy']);
            Route::post('/{id}/pin', [PostController::class, 'pin']);
            Route::post('/{id}/unpin', [PostController::class, 'unpin']);
            Route::post('/{id}/poll/vote', [PostController::class, 'votePoll']);
            Route::get('/{id}/comments', [PostController::class, 'getComments']);
            Route::post('/{id}/comments', [PostController::class, 'addComment']);
            Route::post('/{id}/reactions/toggle', [ReactionController::class, 'togglePostReaction']);
            Route::post('/{id}/share', [PostController::class, 'share']);
            Route::post('/{id}/save', [PostController::class, 'toggleSave']);
            Route::post('/{id}/view', [PostController::class, 'recordView']);
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
            Route::post('/{id}/forward', [ConversationController::class, 'forwardMessage']);
        });

        // Secure chat media access
        Route::prefix('chat')->group(function () {
            Route::get('/media/{media}', [ChatMediaController::class, 'show']);
        });

        Route::prefix('push-tokens')->group(function () {
            Route::post('/', [PushTokenController::class, 'store']);
            Route::delete('/', [PushTokenController::class, 'destroy']);
        });

        // ── Sprint 13: Creator Storefront ──────────────────────────────────
        Route::prefix('storefront')->middleware('store.owner')->group(function () {
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

        // ── Unified Marketplace & Product Endpoints ──────────────────
        Route::get('/marketplace/my/products', [MarketplaceController::class, 'myProducts']);
        Route::post('/marketplace/products', [MarketplaceController::class, 'store']);
        Route::get('/me/products', [MarketplaceController::class, 'myProducts']);
        Route::post('/products', [MarketplaceController::class, 'store']);

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
        Route::prefix('store/categories')->middleware('store.owner')->group(function () {
            Route::get('/', [StoreCategoryController::class, 'index']);
            Route::post('/', [StoreCategoryController::class, 'store']);
            Route::patch('/{category}', [StoreCategoryController::class, 'update']);
            Route::delete('/{category}', [StoreCategoryController::class, 'destroy']);
        });

        // ── Store Inventory ──────────────────────────────────────────
        Route::prefix('store/inventory')->middleware('store.owner')->group(function () {
            Route::get('/', [StoreInventoryController::class, 'index']);
            Route::patch('/{product}', [StoreInventoryController::class, 'update']);
        });

        // ── Store Returns ────────────────────────────────────────────
        Route::prefix('store/returns')->group(function () {
            Route::get('/', [StoreReturnController::class, 'index']);
            Route::post('/', [StoreReturnController::class, 'store']);
            Route::put('/{return}', [StoreReturnController::class, 'update']);
        });

        // ── Store Membership Plans ───────────────────────────────────
        Route::prefix('store/memberships')->middleware('creator')->group(function () {
            Route::get('/', [StoreMembershipPlanController::class, 'index']);
            Route::post('/', [StoreMembershipPlanController::class, 'store']);
            Route::patch('/{plan}', [StoreMembershipPlanController::class, 'update']);
            Route::delete('/{plan}', [StoreMembershipPlanController::class, 'destroy']);
        });

        // ── Store Settings ──────────────────────────────────────────
        Route::prefix('store/settings')->middleware('store.owner')->group(function () {
            Route::get('/', [StoreSettingsController::class, 'show']);
            Route::put('/', [StoreSettingsController::class, 'update']);
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
            Route::get('/', [ContentItemController::class, 'index']);
            Route::post('/', [ContentItemController::class, 'store']);
            Route::patch('/{item}', [ContentItemController::class, 'update']);
            Route::delete('/{item}', [ContentItemController::class, 'destroy']);
        });

        // ── Support Threads ──────────────────────────────────────────
        Route::prefix('support/threads')->group(function () {
            Route::get('/', [SupportController::class, 'index']);
            Route::get('/{thread}/messages', [SupportController::class, 'messages']);
            Route::post('/{thread}/messages', [SupportController::class, 'sendMessage']);
        });

        // ── My Tickets (proxied to the ticket service) ───────────────
        Route::prefix('tickets')->group(function () {
            Route::get('/categories', [TicketProxyController::class, 'categories']);
            Route::get('/', [TicketProxyController::class, 'index']);
            Route::post('/', [TicketProxyController::class, 'store']);
            Route::get('/{ticket}', [TicketProxyController::class, 'show']);
            Route::post('/{ticket}/reply', [TicketProxyController::class, 'reply']);
            Route::post('/{ticket}/status', [TicketProxyController::class, 'status']);
            Route::post('/{ticket}/rate', [TicketProxyController::class, 'rate']);
        });

        // ── Chat Rooms (alias for frontend) ──────────────────────────
        Route::prefix('chat/rooms')->group(function () {
            Route::get('/', [ChatRoomController::class, 'rooms']);
            Route::get('/{room}/messages', [ChatRoomController::class, 'messages']);
            Route::post('/{room}/messages', [ChatRoomController::class, 'sendMessage']);
        });

        // ── Advertising Campaigns & Ads Studio SSO ──────────────────
        Route::prefix('ads')->group(function () {
            Route::get('/', [AdController::class, 'index']);
            Route::post('/', [AdController::class, 'store']);
            Route::post('/sso-token', [AdsSsoController::class, 'getSsoToken']);
            Route::get('/sso-launch', [AdsSsoController::class, 'launchSso']);
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

        // ── Sponsored Advertising Delivery & Tracking ────────────────
        Route::get('/ads/sponsored', [AdsSsoController::class, 'getSponsoredAds']);
        Route::post('/ads/track/impression', [AdsSsoController::class, 'trackImpression']);
        Route::post('/ads/track/click', [AdsSsoController::class, 'trackClick']);

        // ── Gifts & Creator Wallets ─────────────────────────────────
        Route::prefix('gifts')->group(function () {
            Route::get('/', [GiftController::class, 'catalogue']);
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
            Route::get('/', [LinkInBioController::class, 'index']);
            Route::post('/', [LinkInBioController::class, 'storeLink']);
            Route::patch('/{link}', [LinkInBioController::class, 'updateLink']);
            Route::delete('/{link}', [LinkInBioController::class, 'destroyLink']);
            Route::put('/profile', [LinkInBioController::class, 'saveProfile']);
            Route::get('/design', [LinkInBioController::class, 'showDesign']);
            Route::put('/design', [LinkInBioController::class, 'updateDesign']);
            Route::post('/design/apply-theme', [LinkInBioController::class, 'applyTheme']);
            Route::post('/design/apply-template', [LinkInBioController::class, 'applyTemplate']);
            Route::put('/domain', [LinkInBioController::class, 'updateDomain']);
            Route::post('/domain/verify', [LinkInBioController::class, 'verifyDomain']);
            Route::post('/links/{link}/track-click', [LinkInBioController::class, 'trackClick']);

            // Social links
            Route::get('/socials', [LinkInBioController::class, 'indexSocials']);
            Route::post('/socials', [LinkInBioController::class, 'storeSocial']);
            Route::patch('/socials/{social}', [LinkInBioController::class, 'updateSocial']);
            Route::delete('/socials/{social}', [LinkInBioController::class, 'destroySocial']);

            // Products
            Route::get('/products', [LinkInBioController::class, 'indexProducts']);
            Route::post('/products', [LinkInBioController::class, 'storeProduct']);
            Route::patch('/products/{product}', [LinkInBioController::class, 'updateProduct']);
            Route::delete('/products/{product}', [LinkInBioController::class, 'destroyProduct']);
        });

        // ── Marketing Campaigns ──────────────────────────────────────
        Route::prefix('marketing/campaigns')->middleware('creator')->group(function () {
            Route::get('/', [MarketingCampaignController::class, 'index']);
            Route::post('/', [MarketingCampaignController::class, 'store']);
            Route::get('/{campaign}', [MarketingCampaignController::class, 'show']);
            Route::put('/{campaign}', [MarketingCampaignController::class, 'update']);
            Route::delete('/{campaign}', [MarketingCampaignController::class, 'destroy']);
        });

        // ── AI Chat ──────────────────────────────────────────────────
        Route::post('/ai/chat', [AiChatController::class, 'chat'])->middleware('throttle:30,1');

        // ── AI behavior settings (persona, tone, topic guardrails) ─────
        Route::prefix('ai')->group(function () {
            Route::get('/settings', [AiSettingsController::class, 'show']);
            Route::put('/settings', [AiSettingsController::class, 'update']);
        });

        // ── AI Onboarding wizard ─────────────────────────────────────
        Route::prefix('onboarding')->group(function () {
            Route::get('/', [OnboardingController::class, 'state']);
            Route::get('/config', [OnboardingController::class, 'config']);
            Route::post('/progress', [OnboardingController::class, 'saveProgress']);
            Route::post('/vendor-info', [OnboardingController::class, 'saveVendorInfo']);
            Route::post('/member-setup', [OnboardingController::class, 'saveMemberSetup']);
            Route::post('/chat', [OnboardingController::class, 'chat'])->middleware('throttle:30,1');
            Route::post('/about', [OnboardingController::class, 'saveAbout']);
            Route::post('/interests', [OnboardingController::class, 'saveInterests']);
            Route::post('/socials', [OnboardingController::class, 'saveSocials']);
            Route::post('/draft-profile', [OnboardingController::class, 'draftProfile']);
            Route::post('/setup', [OnboardingController::class, 'setup']);
            Route::post('/complete', [OnboardingController::class, 'complete']);
        });

        // ── Connected Social Accounts & Follower Intelligence ────────────
        Route::prefix('social-accounts')->group(function () {
            Route::get('/', [SocialAccountController::class, 'index']);
            Route::get('/supported-providers', [SocialAccountController::class, 'supportedProviders']);
            Route::get('/follower-summary', [SocialAccountController::class, 'followerSummary']);
            Route::post('/manual', [SocialAccountController::class, 'manualConnect']);
            Route::patch('/{id}', [SocialAccountController::class, 'update']);
            Route::delete('/{id}', [SocialAccountController::class, 'destroy']);
        });

        // ── Courses & Creator Goods ──────────────────────────────────
        Route::get('/courses', [CourseController::class, 'index']);
        Route::get('/courses/{course}', [CourseController::class, 'show']);
        Route::get('/users/{id}/courses-and-goods', [CourseController::class, 'userCoursesAndGoods']);
        Route::get('/digital/products', [DigitalProductController::class, 'index']);

        Route::prefix('courses')->middleware('creator')->group(function () {
            Route::post('/', [CourseController::class, 'store']);
            Route::put('/{course}', [CourseController::class, 'update']);
            Route::delete('/{course}', [CourseController::class, 'destroy']);
        });

        // ── Affiliate Products ──────────────────────────────────────
        Route::prefix('affiliate/products')->middleware('creator')->group(function () {
            Route::get('/', [AffiliateProductController::class, 'index']);
            Route::post('/', [AffiliateProductController::class, 'store']);
            Route::get('/{product}', [AffiliateProductController::class, 'show']);
            Route::put('/{product}', [AffiliateProductController::class, 'update']);
            Route::delete('/{product}', [AffiliateProductController::class, 'destroy']);
        });

        // ── Short Links ──────────────────────────────────────────
        Route::prefix('short-links')->group(function () {
            Route::get('/', [ShortLinkController::class, 'index']);
            Route::post('/', [ShortLinkController::class, 'store']);
            Route::delete('/{shortLink}', [ShortLinkController::class, 'destroy']);
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
            Route::get('/birthdays', [FriendRequestController::class, 'birthdays']);
            Route::get('/suggestions', [FriendRequestController::class, 'suggestions']);
            Route::get('/search', [FriendRequestController::class, 'search']);
            Route::post('/contacts/sync', [FriendRequestController::class, 'syncContacts']);
            Route::get('/requests', [FriendRequestController::class, 'index']);
            Route::get('/requests/incoming', [FriendRequestController::class, 'index']);
            Route::get('/requests/sent', [FriendRequestController::class, 'sent']);
            Route::get('/{userId}/status', [FriendRequestController::class, 'status']);
            Route::post('/requests', [FriendRequestController::class, 'send']);
            Route::post('/requests/{id}/accept', [FriendRequestController::class, 'accept']);
            Route::post('/requests/{id}/decline', [FriendRequestController::class, 'decline']);
            Route::post('/requests/{id}/cancel', [FriendRequestController::class, 'cancel']);
            Route::delete('/{userId}', [FriendRequestController::class, 'unfriend']);
        });
        Route::post('/contacts/sync', [FriendRequestController::class, 'syncContacts']);

        // ── Account & Settings (apiClient) ───────────────────────────
        Route::prefix('settings')->group(function () {
            Route::put('/privacy', [ProfileController::class, 'updatePrivacy']);
        });

        Route::prefix('account')->group(function () {
            Route::post('/export', [ProfileController::class, 'exportData']);
            Route::delete('/', [ProfileController::class, 'deleteAccount']);
        });

        // ── Sprint 1: Role Upgrade / Account Transition ──────────────────
        Route::prefix('role')->group(function () {
            Route::get('/application', [RoleUpgradeController::class, 'myApplication']);
            Route::get('/history', [RoleUpgradeController::class, 'myHistory']);
            Route::post('/apply', [RoleUpgradeController::class, 'apply']);
            Route::delete('/apply', [RoleUpgradeController::class, 'cancel']);
        });

        // ── KYC (separate from profile/kyc for frontend compat) ─────
        Route::prefix('kyc')->group(function () {
            Route::get('/status', [KycController::class, 'status']);
            Route::get('/triggers', [KycController::class, 'triggers']);
            Route::post('/submit', [ProfileController::class, 'submitKyc']);
            Route::post('/start', [KycController::class, 'start'])->middleware('throttle:kyc.session');
            Route::get('/history', [KycController::class, 'history']);
            Route::get('/callback', [KycController::class, 'callback']);
        });

        // ── Verified badge (blue checkmark) ─────────────────────────
        Route::prefix('verification-badge')->group(function () {
            Route::get('/status', [VerificationBadgeController::class, 'status']);
            Route::post('/apply', [VerificationBadgeController::class, 'apply']);
            Route::post('/activate', [VerificationBadgeController::class, 'activate']);
            Route::post('/renew', [VerificationBadgeController::class, 'renew']);
            Route::post('/cancel-auto-renew', [VerificationBadgeController::class, 'cancelAutoRenew']);
        });

        // ── Analytics extras ────────────────────────────────────────
        Route::prefix('analytics')->group(function () {
            Route::get('/products', [AnalyticsController::class, 'productPerformance']);
            Route::get('/chat-channels', [AnalyticsController::class, 'chatChannels']);
            Route::get('/content-planner', [AnalyticsController::class, 'contentPlanner']);
            Route::get('/community-activity', [AnalyticsController::class, 'communityActivity']);
            Route::get('/creator-performance', [AnalyticsController::class, 'creatorPerformance']);
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

        Route::get('/conversations/stats', [ConversationController::class, 'stats']);
        Route::get('/messages/recent-activity', [ConversationController::class, 'recentActivity']);
        Route::get('/wallet/overview', [WalletController::class, 'overview']);

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
            Route::get('/vendor', [ProductReviewController::class, 'vendorReviews']);
            Route::post('/{id}/reply', [ProductReviewController::class, 'reply']);
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
            Route::get('/bookings/{id}/livekit-token', [CoachingBookingController::class, 'livekitToken']);
        });

        // ── Native Video Meetings & Conferences (Google Meet Style) ────────
        Route::prefix('meetings')->group(function () {
            Route::post('/instant', [\App\Http\Controllers\MeetingController::class, 'instant']);
            Route::get('/{code}/token', [\App\Http\Controllers\MeetingController::class, 'token']);
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

        // ── Live Streaming & Live Broadcast Core ────────────────────────────
        Route::prefix('live')->group(function () {
            Route::get('/', [LiveStreamController::class, 'index']);
            Route::get('/{id}', [LiveStreamController::class, 'show']);
            Route::get('/{id}/chat', [LiveStreamController::class, 'getMessages']);

            Route::post('/start', [LiveStreamController::class, 'start']);
            Route::post('/{id}/join', [LiveStreamController::class, 'join']);
            Route::post('/{id}/leave', [LiveStreamController::class, 'leave']);
            Route::post('/{id}/like', [LiveStreamController::class, 'like']);
            Route::post('/{id}/chat', [LiveStreamController::class, 'sendMessage']);
            Route::post('/{id}/gift', [LiveStreamController::class, 'sendGift']);
            Route::post('/{id}/end', [LiveStreamController::class, 'end']);
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
                Route::post('/{id}/restore', [AdminUserController::class, 'restore']);
                Route::post('/{id}/impersonate', [AdminUserController::class, 'impersonate']);
                Route::post('/{id}/verify-kyc', [AdminUserController::class, 'verifyKyc']);
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
                Route::get('/', [RoleUpgradeController::class, 'adminIndex']);
                Route::get('/stats', [RoleUpgradeController::class, 'stats']);
                Route::get('/{id}', [RoleUpgradeController::class, 'adminShow']);
                Route::patch('/{id}/approve', [RoleUpgradeController::class, 'approve']);
                Route::patch('/{id}/request-kyc', [RoleUpgradeController::class, 'requestKyc']);
                Route::patch('/{id}/reject', [RoleUpgradeController::class, 'reject']);
            });

            // ── Sprint 2: Verification Badges ───────────────────────────
            Route::prefix('verification-badges')->group(function () {
                Route::get('/', [VerificationBadgeController::class, 'adminIndex']);
                Route::patch('/{userId}/status', [VerificationBadgeController::class, 'adminUpdateStatus']);
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

            // Central Media Management
            Route::prefix('media')->group(function () {
                Route::get('/', [AdminMediaController::class, 'index']);
                Route::get('/stats', [AdminMediaController::class, 'stats']);
                Route::post('/{uuid}/retry', [AdminMediaController::class, 'retry']);
                Route::delete('/{uuid}', [AdminMediaController::class, 'destroy']);
            });

            // Sound & Music Library Management
            Route::prefix('sound-tracks')->group(function () {
                Route::get('/', [SoundTrackController::class, 'adminIndex']);
                Route::post('/', [SoundTrackController::class, 'store']);
                Route::put('/{id}', [SoundTrackController::class, 'update']);
                Route::delete('/{id}', [SoundTrackController::class, 'destroy']);
            });

            // Reconciliation (Sprint 29)
            Route::prefix('reconciliation')->group(function () {
                Route::get('/audit', [ReconciliationController::class, 'audit']);
                Route::get('/ledger-summary', [ReconciliationController::class, 'ledgerSummary']);
            });

            // Payment Infrastructure (Providers, Routing, Transactions, Payouts, Refunds)
            Route::prefix('payment-providers')->group(function () {
                Route::get('/', [AdminPaymentProviderController::class, 'index']);
                Route::post('/', [AdminPaymentProviderController::class, 'store']);
                Route::put('/{code}', [AdminPaymentProviderController::class, 'update']);
                Route::post('/{code}/test-connection', [AdminPaymentProviderController::class, 'testConnection']);
            });

            Route::prefix('payment-routes')->group(function () {
                Route::get('/', [AdminPaymentProviderController::class, 'routes']);
                Route::post('/', [AdminPaymentProviderController::class, 'storeRoute']);
                Route::delete('/{id}', [AdminPaymentProviderController::class, 'destroyRoute']);
                Route::post('/simulate', [AdminPaymentProviderController::class, 'simulateRouting']);
            });

            Route::prefix('payments')->group(function () {
                Route::get('/stats', [AdminPaymentTransactionController::class, 'stats']);
                Route::get('/', [AdminPaymentTransactionController::class, 'payments']);
                Route::get('/{id}', [AdminPaymentTransactionController::class, 'showPayment']);
                Route::post('/{id}/sync', [AdminPaymentTransactionController::class, 'syncPayment']);
                Route::post('/{id}/refund', [AdminPaymentTransactionController::class, 'issueRefund']);
            });

            Route::get('/payouts/all', [AdminPaymentTransactionController::class, 'payouts']);
            Route::get('/refunds/all', [AdminPaymentTransactionController::class, 'refunds']);
            Route::get('/financial-audit-logs', [AdminPaymentTransactionController::class, 'auditLogs']);

            // Multi-Stream Accounting & Tax Compliance Hub
            Route::prefix('accounting')->middleware('admin.permission:accounting')->group(function () {
                Route::get('/overview', [AdminAccountingController::class, 'overview']);
                Route::get('/streams', [AdminAccountingController::class, 'streams']);
                Route::get('/export', [AdminAccountingController::class, 'export']);
            });

            Route::prefix('tax')->middleware('admin.permission:tax')->group(function () {
                Route::get('/summary', [AdminTaxController::class, 'summary']);
                Route::get('/rates', [AdminTaxController::class, 'rates']);
                Route::post('/rates', [AdminTaxController::class, 'storeRate']);
                Route::get('/wht-schedule', [AdminTaxController::class, 'whtSchedule']);
                Route::get('/export', [AdminTaxController::class, 'export']);
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
                Route::get('/health', [QueueMonitorController::class, 'health']);
                Route::get('/stats', [QueueMonitorController::class, 'stats']);
                Route::get('/failed-jobs', [QueueMonitorController::class, 'failedJobs']);
                Route::post('/failed-jobs/{id}/retry', [QueueMonitorController::class, 'retryFailed']);
                Route::post('/failed-jobs/retry-all', [QueueMonitorController::class, 'retryAllFailed']);
                Route::delete('/failed-jobs', [QueueMonitorController::class, 'flushFailed']);
                Route::get('/system-info', [QueueMonitorController::class, 'systemInfo']);
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
            Route::get('/system-health', [AdminSystemHealthController::class, 'index']);

            // ── Moderation Logs ─────────────────────────────────────────────
            Route::get('/moderation-logs', [AdminModerationLogController::class, 'index']);

            // ── Audit Trail ─────────────────────────────────────────────────
            Route::prefix('audit-trail')->group(function () {
                Route::get('/', [AuditLogController::class, 'index']);
            });

            // ── Admin Settings ──────────────────────────────────────────────
            Route::prefix('settings')->group(function () {
                Route::get('/', [AdminSettingsController::class, 'show']);
                Route::put('/', [AdminSettingsController::class, 'update']);
            });

            // ── AI Provider Selection ───────────────────────────────────────
            Route::prefix('ai-settings')->group(function () {
                Route::get('/', [AdminAiSettingsController::class, 'show']);
                Route::put('/', [AdminAiSettingsController::class, 'update']);
                Route::post('/test', [AdminAiSettingsController::class, 'test']);
            });

            // ── Mail Engine & Email Templates ───────────────────────────────
            Route::prefix('mail-settings')->group(function () {
                Route::get('/', [AdminMailSettingsController::class, 'show']);
                Route::put('/', [AdminMailSettingsController::class, 'update']);
                Route::post('/test', [AdminMailSettingsController::class, 'test']);
            });

            // ── SMS Engine ─────────────────────────────────────────────────
            Route::prefix('sms-settings')->group(function () {
                Route::get('/', [AdminSmsSettingsController::class, 'show']);
                Route::put('/', [AdminSmsSettingsController::class, 'update']);
                Route::post('/test', [AdminSmsSettingsController::class, 'test']);
            });

            // ── Social Login (OAuth) Providers ──────────────────────────────
            Route::prefix('social-login')->group(function () {
                Route::get('/', [AdminSocialLoginController::class, 'show']);
                Route::put('/', [AdminSocialLoginController::class, 'update']);
            });

            // ── Authentication Methods ──────────────────────────────────────
            Route::prefix('auth')->middleware('admin.permission:settings')->group(function () {
                Route::get('/methods', [AdminAuthMethodController::class, 'show']);
                Route::put('/methods', [AdminAuthMethodController::class, 'update']);
            });

            // ── Server Media Retention ─────────────────────────────────────
            Route::prefix('messaging-retention')->middleware('admin.permission:settings')->group(function () {
                Route::get('/', [AdminMediaRetentionController::class, 'show']);
                Route::put('/', [AdminMediaRetentionController::class, 'update']);
                Route::post('/run', [AdminMediaRetentionController::class, 'runNow']);
                Route::get('/holds', [AdminMediaRetentionController::class, 'holds']);
                Route::post('/holds', [AdminMediaRetentionController::class, 'placeHold']);
                Route::delete('/holds/{hold}', [AdminMediaRetentionController::class, 'releaseHold']);
                Route::get('/logs', [AdminMediaRetentionController::class, 'logs']);
            });

            // ── Creator Qualification Settings & Events ─────────────────────
            Route::prefix('creator-qualification')->group(function () {
                Route::get('/settings', [AdminSettingsController::class, 'getCreatorQualification']);
                Route::put('/settings', [AdminSettingsController::class, 'updateCreatorQualification']);
                Route::get('/events', [AdminSettingsController::class, 'listQualificationEvents']);
                Route::post('/events/{id}/notify', [AdminSettingsController::class, 'notifyQualificationEvent']);
                Route::get('/accounts', [AdminSettingsController::class, 'listSocialAccounts']);
            });

            Route::prefix('email-templates')->group(function () {
                Route::get('/', [AdminEmailTemplateController::class, 'index']);
                Route::get('{key}', [AdminEmailTemplateController::class, 'show']);
                Route::put('{key}', [AdminEmailTemplateController::class, 'update']);
                Route::post('{key}/reset', [AdminEmailTemplateController::class, 'reset']);
            });

            // ── Storage Configuration ───────────────────────────────────────
            Route::prefix('storage')->group(function () {
                Route::get('/', [AdminStorageController::class, 'show']);
                Route::put('/', [AdminStorageController::class, 'update']);

                Route::prefix('providers')->group(function () {
                    Route::get('/', [AdminObjectStorageProviderController::class, 'index']);
                    Route::post('/', [AdminObjectStorageProviderController::class, 'store']);
                    Route::get('{provider}', [AdminObjectStorageProviderController::class, 'show']);
                    Route::put('{provider}', [AdminObjectStorageProviderController::class, 'update']);
                    Route::delete('{provider}', [AdminObjectStorageProviderController::class, 'destroy']);
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
                Route::get('/settings', [AdminStoryController::class, 'show']);
                Route::put('/settings', [AdminStoryController::class, 'update']);
            });

            // ── Conversion Metrics ─────────────────────────────────────────
            Route::get('/analytics/conversions', [AdminConversionMetricsController::class, 'index']);
        });
    });
});
