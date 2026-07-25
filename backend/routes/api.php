<?php

use App\Http\Controllers\AdminDashboardController;
use App\Http\Controllers\AdminKycController;
use App\Http\Controllers\AdminUserController;
use App\Http\Controllers\AudioRoomController;
use App\Http\Controllers\AuditLogController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\BlockController;
use App\Http\Controllers\CheckoutController;
use App\Http\Controllers\CoachingBookingController;
use App\Http\Controllers\CoachingServiceController;
use App\Http\Controllers\CommunityController;
use App\Http\Controllers\ConversationController;
use App\Http\Controllers\ConversationSettingsController;
use App\Http\Controllers\DigitalProductController;
use App\Http\Controllers\DonationController;
use App\Http\Controllers\EventController;
use App\Http\Controllers\FeatureFlagController;
use App\Http\Controllers\MembershipController;
use App\Http\Controllers\MessageAttachmentController;
use App\Http\Controllers\MessageReactionController;
use App\Http\Controllers\ModerationController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\NotificationPreferenceController;
use App\Http\Controllers\OrderController;
use App\Http\Controllers\PageSectionController;
use App\Http\Controllers\PostController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\PurchaseController;
use App\Http\Controllers\PushTokenController;
use App\Http\Controllers\RoleController;
use App\Http\Controllers\StorefrontController;
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

    // Authentication Routes
    Route::prefix('auth')->group(function () {
        Route::post('/register', [AuthController::class, 'register']);
        Route::post('/login', [AuthController::class, 'login']);

        Route::middleware('auth:sanctum')->group(function () {
            Route::post('/logout', [AuthController::class, 'logout']);
            Route::post('/email/resend', [VerificationController::class, 'resend']);
        });

        Route::get('/email/verify/{id}/{hash}', [VerificationController::class, 'verify'])
            ->name('verification.verify');
    });

    // Public Community, Membership & Feed Endpoints
    Route::prefix('communities')->group(function () {
        Route::get('/', [CommunityController::class, 'index']);
        Route::get('/{slug}', [CommunityController::class, 'show']);
        Route::get('/{id}/members', [MembershipController::class, 'members']);
        Route::get('/{id}/roles', [RoleController::class, 'index']);
        Route::get('/{id}/posts', [PostController::class, 'index']);
    });

    Route::get('/feed', [PostController::class, 'globalFeed']);

    // Public Storefront Profile Endpoint
    Route::get('/stores/{shortCode}', [StorefrontController::class, 'show']);
    Route::get('/public/products/{slug}', [DigitalProductController::class, 'publicShow']);

    // Sprint 15: Public payment webhook (no auth — provider calls this)
    Route::post('/checkout/webhooks/{provider}', [CheckoutController::class, 'handleWebhook']);

    // Sprint 20: Public Event Endpoints
    Route::prefix('events')->group(function () {
        Route::get('/', [EventController::class, 'index']);
        Route::get('/{id}', [EventController::class, 'show']);
    });

    // Sprint 19: System health (no auth required)
    Route::get('/health', function () {
        $dbConnected = false;
        $cacheConnected = false;
        $queueResponsive = false;

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

        return response()->json([
            'status' => $dbConnected && $cacheConnected ? 'healthy' : 'degraded',
            'timestamp' => now()->toIso8601String(),
            'services' => [
                'database' => $dbConnected ? 'connected' : 'disconnected',
                'cache' => $cacheConnected ? 'connected' : 'disconnected',
                'queue' => $queueResponsive ? 'responsive' : 'unresponsive',
            ],
        ]);
    });

    // Authenticated Endpoints
    Route::middleware('auth:sanctum')->group(function () {
        Route::get('/user', function (Request $request) {
            return response()->json([
                'id' => $request->user()->id,
                'name' => $request->user()->name,
                'email' => $request->user()->email,
                'username' => $request->user()->username,
                'role' => $request->user()->role,
                'kyc_status' => $request->user()->kyc_status,
                'email_verified' => $request->user()->hasVerifiedEmail(),
            ]);
        });

        // Profile Management
        Route::prefix('profile')->group(function () {
            Route::get('/', [ProfileController::class, 'show']);
            Route::put('/', [ProfileController::class, 'update']);
            Route::post('/kyc', [ProfileController::class, 'submitKyc']);
        });

        // My Communities
        Route::prefix('my-communities')->group(function () {
            Route::get('/', [CommunityController::class, 'myCommunities']);
            Route::post('/', [CommunityController::class, 'store']);
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
            Route::post('/{id}/comments', [PostController::class, 'addComment']);
            Route::post('/{id}/reactions', [PostController::class, 'toggleReaction']);
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
        });

        // ── Sprint 11-12: Messages, Reactions, Attachments, Push Tokens ──
        Route::prefix('messages')->group(function () {
            Route::post('/attachments', [MessageAttachmentController::class, 'upload']);
            Route::post('/{id}/reactions', [MessageReactionController::class, 'toggle']);
            Route::get('/{id}/reactions', [MessageReactionController::class, 'index']);
        });

        Route::prefix('push-tokens')->group(function () {
            Route::post('/', [PushTokenController::class, 'store']);
            Route::delete('/', [PushTokenController::class, 'destroy']);
        });

        // ── Sprint 13: Creator Storefront ──────────────────────────────────
        Route::prefix('storefront')->group(function () {
            Route::get('/', [StorefrontController::class, 'mine']);
            Route::put('/', [StorefrontController::class, 'update']);
            Route::post('/publish', [StorefrontController::class, 'publish']);
        });

        // ── Sprint 14: Digital Products ────────────────────────────────────
        Route::prefix('store/products')->group(function () {
            Route::get('/', [DigitalProductController::class, 'index']);
            Route::post('/', [DigitalProductController::class, 'store']);
            Route::get('/{id}', [DigitalProductController::class, 'show']);
            Route::put('/{id}', [DigitalProductController::class, 'update']);
            Route::post('/{id}/publish', [DigitalProductController::class, 'publish']);
            Route::delete('/{id}', [DigitalProductController::class, 'destroy']);
        });
        Route::get('/products/{id}/download', [DigitalProductController::class, 'download']);

        // ── Sprint 15: Checkout & Orders ───────────────────────────────────
        Route::prefix('checkout')->group(function () {
            Route::post('/intent', [CheckoutController::class, 'createIntent']);
            Route::post('/complete-mock', [CheckoutController::class, 'completeMock']);
        });

        Route::prefix('orders')->group(function () {
            Route::get('/mine', [OrderController::class, 'myOrders']);
            Route::get('/sales', [OrderController::class, 'creatorSales']);
            Route::get('/{id}/receipt', [OrderController::class, 'receipt']);
        });

        // ── Sprint 16: MurihPay Wallet ─────────────────────────────────────
        Route::prefix('wallet')->group(function () {
            Route::get('/', [WalletController::class, 'show']);
            Route::post('/pin/setup', [WalletController::class, 'setupPin']);
            Route::post('/pin/update', [WalletController::class, 'updatePin']);
            Route::post('/pin/verify', [WalletController::class, 'verifyPin']);
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
            Route::post('/withdrawals', [WithdrawalController::class, 'request']);
            Route::get('/withdrawals', [WithdrawalController::class, 'myRequests']);
        });

        // ── Sprint 22: Subscriptions & Membership Plans ───────────────────
        Route::prefix('subscriptions')->group(function () {
            Route::get('/plans/public', [SubscriptionPlanController::class, 'indexPublic']);
            Route::get('/plans/my', [SubscriptionPlanController::class, 'myPlans']);
            Route::get('/plans/creator/{creatorId}', [SubscriptionPlanController::class, 'indexForCreator']);
            Route::post('/plans', [SubscriptionPlanController::class, 'store']);
            Route::get('/plans/{id}', [SubscriptionPlanController::class, 'show']);
            Route::put('/plans/{id}', [SubscriptionPlanController::class, 'update']);
            Route::delete('/plans/{id}', [SubscriptionPlanController::class, 'destroy']);

            Route::get('/mine', [SubscriptionController::class, 'mySubscriptions']);
            Route::get('/subscribers', [SubscriptionController::class, 'mySubscribers']);
            Route::post('/subscribe', [SubscriptionController::class, 'subscribe']);
            Route::post('/{id}/cancel', [SubscriptionController::class, 'cancel']);
            Route::get('/stats', [SubscriptionController::class, 'creatorStats']);
        });

        // ── Sprint 21: Coaching & Booking Services ─────────────────────────
        Route::prefix('coaching')->group(function () {
            Route::get('/services', [CoachingServiceController::class, 'indexPublic']);
            Route::get('/services/{id}', [CoachingServiceController::class, 'show']);

            Route::get('/my-services', [CoachingServiceController::class, 'myServices']);
            Route::post('/services', [CoachingServiceController::class, 'store']);
            Route::put('/services/{id}', [CoachingServiceController::class, 'update']);
            Route::delete('/services/{id}', [CoachingServiceController::class, 'destroy']);

            Route::post('/services/{id}/slots/generate', [CoachingServiceController::class, 'generateSlots']);
            Route::get('/services/{id}/slots', [CoachingServiceController::class, 'slots']);
            Route::delete('/services/{id}/slots/{slotId}', [CoachingServiceController::class, 'deleteSlot']);

            Route::post('/book', [CoachingBookingController::class, 'book']);
            Route::get('/my-bookings', [CoachingBookingController::class, 'myBookings']);
            Route::get('/my-sessions', [CoachingBookingController::class, 'mySessions']);
            Route::post('/bookings/{id}/cancel', [CoachingBookingController::class, 'cancel']);
            Route::post('/bookings/{id}/complete', [CoachingBookingController::class, 'complete']);
        });

        // ── Sprint 20: Events ──────────────────────────────────────────────
        Route::prefix('my-events')->group(function () {
            Route::get('/', [EventController::class, 'myEvents']);
            Route::post('/', [EventController::class, 'store']);
            Route::get('/{id}', [EventController::class, 'show']);
            Route::put('/{id}', [EventController::class, 'update']);
            Route::post('/{id}/publish', [EventController::class, 'publish']);
            Route::delete('/{id}', [EventController::class, 'destroy']);
        });

        Route::prefix('events')->group(function () {
            Route::post('/{eventId}/register', [EventController::class, 'register']);
            Route::post('/{eventId}/cancel', [EventController::class, 'cancelRegistration']);
            Route::get('/{eventId}/registrations', [EventController::class, 'registrations']);
            Route::post('/{eventId}/check-in', [EventController::class, 'checkIn']);
        });

        Route::get('/my-registrations', [EventController::class, 'myRegistrations']);

        // ── Sprint 23: Audio Rooms ─────────────────────────────────────────
        Route::prefix('audio-rooms')->group(function () {
            Route::get('/', [AudioRoomController::class, 'index']);
            Route::get('/my-rooms', [AudioRoomController::class, 'myRooms']);
            Route::post('/', [AudioRoomController::class, 'store']);
            Route::get('/{id}', [AudioRoomController::class, 'show']);
            Route::put('/{id}', [AudioRoomController::class, 'update']);
            Route::delete('/{id}', [AudioRoomController::class, 'destroy']);

            Route::post('/{id}/start', [AudioRoomController::class, 'start']);
            Route::post('/{id}/end', [AudioRoomController::class, 'end']);
            Route::post('/{id}/join', [AudioRoomController::class, 'join']);
            Route::post('/{id}/leave', [AudioRoomController::class, 'leave']);
            Route::post('/{id}/raise-hand', [AudioRoomController::class, 'raiseHand']);
            Route::post('/{id}/users/{userId}/role', [AudioRoomController::class, 'updateRole']);
            Route::post('/{id}/users/{userId}/mute', [AudioRoomController::class, 'toggleMute']);
        });

        // ── Sprint 17: Core Administration (securegate) ────────────────────
        Route::prefix('securegate')->middleware('admin')->group(function () {
            // Dashboard
            Route::get('/dashboard', [AdminDashboardController::class, 'stats']);

            // Users
            Route::prefix('users')->group(function () {
                Route::get('/', [AdminUserController::class, 'index']);
                Route::get('/{id}', [AdminUserController::class, 'show']);
                Route::post('/{id}/suspend', [AdminUserController::class, 'suspend']);
                Route::post('/{id}/activate', [AdminUserController::class, 'activate']);
                Route::post('/{id}/ban', [AdminUserController::class, 'ban']);
            });

            // KYC
            Route::prefix('kyc')->group(function () {
                Route::get('/', [AdminKycController::class, 'index']);
                Route::post('/{user}/approve', [AdminKycController::class, 'approve']);
                Route::post('/{user}/reject', [AdminKycController::class, 'reject']);
            });

            // Withdrawals
            Route::prefix('withdrawals')->group(function () {
                Route::get('/', [WithdrawalController::class, 'adminIndex']);
                Route::post('/{id}/process', [WithdrawalController::class, 'adminProcess']);
            });

            // Reports
            Route::prefix('reports')->group(function () {
                Route::get('/', [ModerationController::class, 'index']);
                Route::post('/{report}/action', [ModerationController::class, 'action']);
            });

            // Orders
            Route::get('/orders', [OrderController::class, 'adminIndex']);

            // Audit Logs
            Route::prefix('audit-logs')->group(function () {
                Route::get('/', [AuditLogController::class, 'index']);
                Route::get('/{id}', [AuditLogController::class, 'show']);
            });

            // Feature Flags
            Route::prefix('feature-flags')->group(function () {
                Route::get('/', [FeatureFlagController::class, 'index']);
                Route::post('/', [FeatureFlagController::class, 'store']);
                Route::put('/{id}', [FeatureFlagController::class, 'update']);
                Route::delete('/{id}', [FeatureFlagController::class, 'destroy']);
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
        });
    });
});
