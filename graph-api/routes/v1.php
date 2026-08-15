<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\V1\HealthController;
use App\Http\Controllers\V1\MeController;
use App\Http\Controllers\V1\UserController;
use App\Http\Controllers\V1\PostController;
use App\Http\Controllers\V1\SocialController;
use App\Http\Controllers\V1\BusinessController;
use App\Http\Controllers\V1\ProductController;
// Phase 3
use App\Http\Controllers\V1\AdAccountController;
use App\Http\Controllers\V1\CampaignController;
use App\Http\Controllers\V1\AdGroupController;
use App\Http\Controllers\V1\AdController;
// Phase 4
use App\Http\Controllers\V1\TicketController;
use App\Http\Controllers\V1\HelpController;
use App\Http\Controllers\V1\MarketingContentController;
// Phase 5
use App\Http\Controllers\V1\DeveloperAppController;
use App\Http\Controllers\V1\OAuthController;
use App\Http\Controllers\V1\WebhookController;
use App\Http\Controllers\V1\OpenApiController;

// ===========================================================================
// Phase 1, 4 & 5 — Public endpoints (no auth, low rate limit)
// ===========================================================================
Route::middleware(['throttle:60,1'])->group(function () {
    Route::get('/v1/health', [HealthController::class, 'index']);

    // Public store profile (no auth required)
    Route::get('/v1/stores/{shortCode}',       [BusinessController::class, 'storeByShortCode']);
    Route::get('/v1/stores/{shortCode}/posts', [BusinessController::class, 'storePosts']);

    // Phase 4: Help Center KB & Public CMS / Announcements
    Route::get('/v1/help/categories',              [HelpController::class, 'categories']);
    Route::get('/v1/help/articles',                [HelpController::class, 'articles']);
    Route::get('/v1/help/articles/{slug}',          [HelpController::class, 'show']);
    Route::get('/v1/help/search',                  [HelpController::class, 'search']);
    Route::post('/v1/help/articles/{slug}/feedback', [HelpController::class, 'feedback']);

    Route::get('/v1/announcements',                [MarketingContentController::class, 'announcements']);
    Route::get('/v1/cms/{section}',                [MarketingContentController::class, 'cmsSection']);
    Route::get('/v1/cms/{section}/{slug}',        [MarketingContentController::class, 'cmsItem']);

    // Phase 5: OAuth Token & OpenAPI Spec & SDKs (public)
    Route::get('/v1/oauth/scopes',  [OAuthController::class, 'scopes']);
    Route::post('/v1/oauth/token',  [OAuthController::class, 'token']);
    Route::get('/v1/openapi.json',  [OpenApiController::class, 'index']);
    Route::get('/v1/sdks',          [OpenApiController::class, 'sdks']);
});

// ===========================================================================
// Phase 1, 2, 3, 4, 5 — Authenticated endpoints
// ===========================================================================
Route::middleware(['graph.auth', 'throttle:200,1'])->group(function () {

    // ── /me — current identity and its edges ──────────────────────────────
    Route::get('/v1/me', [MeController::class, 'show']);
    Route::get('/v1/me/posts',       [MeController::class, 'posts']);
    Route::get('/v1/me/followers',   [MeController::class, 'followers']);
    Route::get('/v1/me/following',   [MeController::class, 'following']);
    Route::get('/v1/me/businesses',  [MeController::class, 'businesses']);
    Route::get('/v1/me/products',    [MeController::class, 'products']);
    Route::get('/v1/me/ad-accounts', [MeController::class, 'adAccounts']);
    Route::get('/v1/me/tickets',     [MeController::class, 'tickets']);

    // ── Users ─────────────────────────────────────────────────────────────
    Route::get('/v1/users/{id}', [UserController::class, 'show'])
        ->middleware('graph.scope:profile.read');

    // Phase 2: User social-graph edges
    Route::get('/v1/users/{id}/posts',     [SocialController::class, 'userPosts'])
        ->middleware('graph.scope:posts.read');
    Route::get('/v1/users/{id}/followers', [SocialController::class, 'followers'])
        ->middleware('graph.scope:followers.read');
    Route::get('/v1/users/{id}/following', [SocialController::class, 'following'])
        ->middleware('graph.scope:followers.read');
    Route::get('/v1/users/{id}/friends',   [SocialController::class, 'friends'])
        ->middleware('graph.scope:profile.read');

    // Phase 2: User business/product edges
    Route::get('/v1/users/{id}/businesses', [BusinessController::class, 'userBusinesses'])
        ->middleware('graph.scope:business.read');
    Route::get('/v1/users/{id}/products',   [ProductController::class, 'userProducts'])
        ->middleware('graph.scope:products.read');

    // ── Posts & edges ─────────────────────────────────────────────────────
    Route::get('/v1/posts/{id}', [PostController::class, 'show'])
        ->middleware('graph.scope:posts.read');
    Route::get('/v1/posts/{id}/comments', [PostController::class, 'comments'])
        ->middleware('graph.scope:comments.read');

    // ── Phase 2: Businesses ───────────────────────────────────────────────
    Route::get('/v1/businesses/{id}', [BusinessController::class, 'show'])
        ->middleware('graph.scope:business.read');
    Route::get('/v1/businesses/{id}/products', [BusinessController::class, 'products'])
        ->middleware('graph.scope:products.read');

    // ── Phase 2: Products ─────────────────────────────────────────────────
    Route::get('/v1/products/{id}', [ProductController::class, 'show'])
        ->middleware('graph.scope:products.read');

    // ── Phase 3: Ad accounts ──────────────────────────────────────────────
    Route::prefix('/v1')->middleware('graph.scope:ads.read')->group(function () {
        Route::get('/ad-accounts',                      [AdAccountController::class, 'index']);
        Route::get('/ad-accounts/{id}',                 [AdAccountController::class, 'show']);
        Route::get('/ad-accounts/{id}/campaigns',       [AdAccountController::class, 'campaigns']);
        Route::get('/ad-accounts/{id}/analytics',       [AdAccountController::class, 'analytics']);

        // Campaigns
        Route::get('/campaigns/{id}',                   [CampaignController::class, 'show']);
        Route::get('/campaigns/{id}/ad-groups',         [CampaignController::class, 'adGroups']);
        Route::get('/campaigns/{id}/ads',               [CampaignController::class, 'ads']);

        // Ad groups
        Route::get('/ad-groups/{id}',                   [AdGroupController::class, 'show']);
        Route::get('/ad-groups/{id}/ads',               [AdGroupController::class, 'ads']);

        // Individual ads + creative
        Route::get('/ads/{id}',                         [AdController::class, 'show']);
        Route::get('/ads/{id}/creative',                [AdController::class, 'creative']);
    });

    // ── Phase 4: Customer Support Tickets ─────────────────────────────────
    Route::prefix('/v1')->middleware('graph.scope:support.read')->group(function () {
        Route::get('/tickets/categories',               [TicketController::class, 'categories']);
        Route::get('/tickets',                          [TicketController::class, 'index']);
        Route::post('/tickets',                         [TicketController::class, 'store'])
            ->middleware('graph.scope:support.write');
        Route::get('/tickets/{id}',                     [TicketController::class, 'show']);
        Route::post('/tickets/{id}/reply',              [TicketController::class, 'reply'])
            ->middleware('graph.scope:support.write');
        Route::post('/tickets/{id}/status',             [TicketController::class, 'status'])
            ->middleware('graph.scope:support.write');
        Route::post('/tickets/{id}/rate',               [TicketController::class, 'rate'])
            ->middleware('graph.scope:support.write');
    });

    // ── Phase 5: Developer Platform ───────────────────────────────────────
    Route::prefix('/v1/developer')->group(function () {
        Route::get('/apps',                             [DeveloperAppController::class, 'index']);
        Route::post('/apps',                            [DeveloperAppController::class, 'store']);
        Route::get('/apps/{id}',                        [DeveloperAppController::class, 'show']);
        Route::put('/apps/{id}',                        [DeveloperAppController::class, 'update']);
        Route::delete('/apps/{id}',                     [DeveloperAppController::class, 'destroy']);
        Route::post('/apps/{id}/rotate-secret',         [DeveloperAppController::class, 'rotateSecret']);
    });

    Route::prefix('/v1/webhooks')->group(function () {
        Route::get('/',                                 [WebhookController::class, 'index']);
        Route::post('/',                                [WebhookController::class, 'store']);
        Route::delete('/{id}',                          [WebhookController::class, 'destroy']);
        Route::post('/dispatch',                        [WebhookController::class, 'dispatch']);
    });
});



