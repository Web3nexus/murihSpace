<?php

use App\Http\Controllers\AdminKycController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\BlockController;
use App\Http\Controllers\CommunityController;
use App\Http\Controllers\MembershipController;
use App\Http\Controllers\ModerationController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\NotificationPreferenceController;
use App\Http\Controllers\PostController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\RoleController;
use App\Http\Controllers\VerificationController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function () {
    // Service readiness check
    Route::get('/ready', function (Request $request) {
        try {
            DB::connection()->getPdo();
            $dbReady = true;
        } catch (\Exception $e) {
            $dbReady = false;
        }

        return response()->json([
            'status' => 'ready',
            'api_version' => 'v1',
            'services' => [
                'database' => $dbReady ? 'connected' : 'disconnected',
            ]
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
    Route::get('/stores/{shortCode}', [\App\Http\Controllers\StorefrontController::class, 'show']);
    Route::get('/public/products/{slug}', [\App\Http\Controllers\DigitalProductController::class, 'publicShow']);

    // Sprint 15: Public payment webhook (no auth — provider calls this)
    Route::post('/checkout/webhooks/{provider}', [\App\Http\Controllers\CheckoutController::class, 'handleWebhook']);

    // Authenticated Endpoints
    Route::middleware('auth:sanctum')->group(function () {
        Route::get('/user', function (Request $request) {
            return response()->json([
                'id'             => $request->user()->id,
                'name'           => $request->user()->name,
                'email'          => $request->user()->email,
                'username'       => $request->user()->username,
                'role'           => $request->user()->role,
                'kyc_status'     => $request->user()->kyc_status,
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
            Route::get('/', [\App\Http\Controllers\ConversationController::class, 'index']);
            Route::post('/direct', [\App\Http\Controllers\ConversationController::class, 'startDirect']);
            Route::get('/community/{communityId}', [\App\Http\Controllers\ConversationController::class, 'getCommunityChat']);
            Route::get('/saved', [\App\Http\Controllers\ConversationController::class, 'getSavedMessages']);
            Route::get('/{id}/messages', [\App\Http\Controllers\ConversationController::class, 'messages']);
            Route::post('/{id}/messages', [\App\Http\Controllers\ConversationController::class, 'sendMessage']);
            Route::post('/{id}/read', [\App\Http\Controllers\ConversationController::class, 'markRead']);
            // Sprint 12
            Route::post('/{id}/typing', [\App\Http\Controllers\ConversationController::class, 'typing']);
            Route::get('/{id}/settings', [\App\Http\Controllers\ConversationSettingsController::class, 'show']);
            Route::put('/{id}/settings', [\App\Http\Controllers\ConversationSettingsController::class, 'update']);
        });

        // ── Sprint 12: Message Reactions & Push Tokens ────────────────────
        Route::prefix('messages')->group(function () {
            Route::post('/{id}/reactions', [\App\Http\Controllers\MessageReactionController::class, 'toggle']);
            Route::get('/{id}/reactions', [\App\Http\Controllers\MessageReactionController::class, 'index']);
        });

        Route::prefix('push-tokens')->group(function () {
            Route::post('/', [\App\Http\Controllers\PushTokenController::class, 'store']);
            Route::delete('/', [\App\Http\Controllers\PushTokenController::class, 'destroy']);
        });

        // ── Sprint 13: Creator Storefront ──────────────────────────────────
        Route::prefix('storefront')->group(function () {
            Route::get('/', [\App\Http\Controllers\StorefrontController::class, 'mine']);
            Route::put('/', [\App\Http\Controllers\StorefrontController::class, 'update']);
            Route::post('/publish', [\App\Http\Controllers\StorefrontController::class, 'publish']);
        });

        // ── Sprint 14: Digital Products ────────────────────────────────────
        Route::prefix('store/products')->group(function () {
            Route::get('/', [\App\Http\Controllers\DigitalProductController::class, 'index']);
            Route::post('/', [\App\Http\Controllers\DigitalProductController::class, 'store']);
            Route::get('/{id}', [\App\Http\Controllers\DigitalProductController::class, 'show']);
            Route::put('/{id}', [\App\Http\Controllers\DigitalProductController::class, 'update']);
            Route::post('/{id}/publish', [\App\Http\Controllers\DigitalProductController::class, 'publish']);
            Route::delete('/{id}', [\App\Http\Controllers\DigitalProductController::class, 'destroy']);
        });
        Route::get('/products/{id}/download', [\App\Http\Controllers\DigitalProductController::class, 'download']);

        // ── Sprint 15: Checkout & Orders ───────────────────────────────────
        Route::prefix('checkout')->group(function () {
            Route::post('/intent', [\App\Http\Controllers\CheckoutController::class, 'createIntent']);
            Route::post('/complete-mock', [\App\Http\Controllers\CheckoutController::class, 'completeMock']);
        });

        Route::prefix('orders')->group(function () {
            Route::get('/mine', [\App\Http\Controllers\OrderController::class, 'myOrders']);
            Route::get('/sales', [\App\Http\Controllers\OrderController::class, 'creatorSales']);
            Route::get('/{id}/receipt', [\App\Http\Controllers\OrderController::class, 'receipt']);
        });

        // ── Sprint 16: MurihPay Wallet ─────────────────────────────────────
        Route::prefix('wallet')->group(function () {
            Route::get('/', [\App\Http\Controllers\WalletController::class, 'show']);
            Route::post('/pin/setup', [\App\Http\Controllers\WalletController::class, 'setupPin']);
            Route::post('/pin/update', [\App\Http\Controllers\WalletController::class, 'updatePin']);
            Route::post('/pin/verify', [\App\Http\Controllers\WalletController::class, 'verifyPin']);
            Route::get('/transactions', [\App\Http\Controllers\WalletController::class, 'transactions']);

            // Transfers
            Route::post('/transfers/send', [\App\Http\Controllers\TransferController::class, 'send']);
            Route::get('/transfers/sent', [\App\Http\Controllers\TransferController::class, 'sent']);
            Route::get('/transfers/received', [\App\Http\Controllers\TransferController::class, 'received']);

            // Donations
            Route::post('/donations/send', [\App\Http\Controllers\DonationController::class, 'send']);
            Route::get('/donations/sent', [\App\Http\Controllers\DonationController::class, 'sent']);
            Route::get('/donations/received', [\App\Http\Controllers\DonationController::class, 'received']);

            // Purchases
            Route::get('/purchases', [\App\Http\Controllers\PurchaseController::class, 'index']);
            Route::post('/purchases/{id}/download', [\App\Http\Controllers\PurchaseController::class, 'download']);

            // Withdrawals
            Route::post('/withdrawals', [\App\Http\Controllers\WithdrawalController::class, 'request']);
            Route::get('/withdrawals', [\App\Http\Controllers\WithdrawalController::class, 'myRequests']);
        });

        // Admin: Withdrawal processing
        Route::prefix('admin')->group(function () {
            Route::get('/withdrawals', [\App\Http\Controllers\WithdrawalController::class, 'adminIndex']);
            Route::post('/withdrawals/{id}/process', [\App\Http\Controllers\WithdrawalController::class, 'adminProcess']);
        });

        // ── Admin ──────────────────────────────────────────────────────────
        Route::prefix('admin')->group(function () {
            Route::prefix('kyc')->group(function () {
                Route::get('/', [AdminKycController::class, 'index']);
                Route::post('/{user}/approve', [AdminKycController::class, 'approve']);
                Route::post('/{user}/reject', [AdminKycController::class, 'reject']);
            });

            Route::prefix('reports')->group(function () {
                Route::get('/', [ModerationController::class, 'index']);
                Route::post('/{report}/action', [ModerationController::class, 'action']);
            });

            Route::get('/orders', [\App\Http\Controllers\OrderController::class, 'adminIndex']);
        });
    });
});
