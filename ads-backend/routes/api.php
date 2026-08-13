<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\WalletController;
use App\Http\Controllers\Api\DeliveryController;
use App\Http\Controllers\Api\CampaignController;
use App\Http\Controllers\Api\AdGroupController;
use App\Http\Controllers\Api\AdController;
use App\Http\Controllers\Api\AdminController;
use App\Http\Controllers\Api\TrackingController;
use App\Http\Controllers\Api\AnalyticsController;

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/user', function (Request $request) {
        return $request->user();
    });

    // Core Ads Manager Resources
    Route::apiResource('campaigns', CampaignController::class);
    Route::apiResource('ad-groups', AdGroupController::class);
    Route::apiResource('ads', AdController::class);

    // Wallet & Billing Routes
    Route::prefix('wallet')->group(function () {
        Route::get('/', [WalletController::class, 'index']);
        Route::post('/fund', [WalletController::class, 'fund']);
    });

    // Analytics Routes
    Route::prefix('analytics')->group(function () {
        Route::get('/report', [AnalyticsController::class, 'report']);
    });
});

use App\Http\Middleware\AdminMiddleware;

// Admin Moderation Routes
Route::middleware(['auth:sanctum', AdminMiddleware::class])->prefix('admin')->group(function () {
    Route::get('/creatives/pending', [AdminController::class, 'getPendingCreatives']);
    Route::post('/creatives/{id}/moderate', [AdminController::class, 'moderateCreative']);
    
    Route::get('/advertisers/pending', [AdminController::class, 'getPendingAdvertisers']);
    Route::post('/advertisers/{id}/verify', [AdminController::class, 'verifyAdvertiser']);

    // Global Ads Moderation
    Route::get('/ads', [AdminController::class, 'getCampaigns']);
    Route::get('/ads/stats', [AdminController::class, 'getCampaignStats']);
    Route::get('/ads/revenue', [AdminController::class, 'getRevenue']);
    Route::post('/ads/{id}/{action}', [AdminController::class, 'moderateCampaign']);
});

// Ad Delivery Route (Publicly accessible by the main app backend/frontend)
Route::prefix('delivery')->group(function () {
    Route::get('/ad', [DeliveryController::class, 'getAd']);
});

// Analytics & Tracking Routes
Route::prefix('tracking')->group(function () {
    Route::get('/impression', [TrackingController::class, 'impression']);
    Route::get('/click', [TrackingController::class, 'click']);
    Route::post('/conversion', [TrackingController::class, 'conversion']);
});
