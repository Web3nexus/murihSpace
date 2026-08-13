<?php

use App\Http\Controllers\Internal\SupportInternalController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Internal Service API
|--------------------------------------------------------------------------
|
| Restricted service-to-service endpoints consumed by trusted internal
| services (e.g. marketing-backend). Protected by the `internal` middleware:
| shared token + timestamp window + nonce replay protection + rate limit.
| Never expose these publicly.
|
*/

Route::prefix('support')->group(function () {
    Route::get('/users/by-email/{email}', [SupportInternalController::class, 'userByEmail']);
    Route::get('/users/{user}/summary', [SupportInternalController::class, 'userSummary']);
    Route::get('/users/{user}/orders', [SupportInternalController::class, 'userOrders']);
    Route::get('/users/{user}/subscriptions', [SupportInternalController::class, 'userSubscriptions']);
    Route::get('/users/{user}/wallet-summary', [SupportInternalController::class, 'userWalletSummary']);
    Route::get('/users/{user}/kyc-summary', [SupportInternalController::class, 'userKycSummary']);
    Route::get('/users/{user}/transactions', [SupportInternalController::class, 'userTransactions']);
    Route::get('/transactions/{transaction}/summary', [SupportInternalController::class, 'transactionSummary']);
    Route::get('/orders/{order}', [SupportInternalController::class, 'orderSummary']);
    Route::post('/notifications', [SupportInternalController::class, 'notifyCustomer']);
});
