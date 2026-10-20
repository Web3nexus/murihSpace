<?php

use App\Http\Controllers\Api\Staff\StaffAccountController;
use App\Http\Controllers\Api\Staff\StaffAdsTokenController;
use App\Http\Controllers\Api\Staff\StaffLoginController;
use App\Http\Controllers\Internal\SupportEventController;
use App\Http\Controllers\Public\PublicAnnouncementController;
use App\Http\Controllers\Public\PublicCmsController;
use App\Http\Controllers\Public\PublicCustomerTicketController;
use App\Http\Controllers\Public\PublicHelpController;
use App\Http\Controllers\Public\PublicTicketController;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Str;

// ── Public read-only content API (marketing + apps) ─────────────
Route::prefix('public')->middleware(['cache.public', 'throttle:public'])->group(function () {
    Route::prefix('help')->group(function () {
        Route::get('/search', [PublicHelpController::class, 'search'])->name('public.help.search');
        Route::get('/categories', [PublicHelpController::class, 'categories'])->name('public.help.categories');
        Route::get('/articles', [PublicHelpController::class, 'articles'])->name('public.help.articles');
        Route::get('/articles/{slug}', [PublicHelpController::class, 'article'])->name('public.help.article');
    });

    Route::prefix('cms')->group(function () {
        Route::get('/{section}', [PublicCmsController::class, 'section'])->name('public.cms.section');
        Route::get('/{section}/{slug}', [PublicCmsController::class, 'item'])->name('public.cms.item');
    });

    Route::get('/announcements', [PublicAnnouncementController::class, 'index'])->name('public.announcements');
});

// Feedback and customer-initiated actions are not cacheable.
Route::prefix('public')->middleware('throttle:public')->group(function () {
    Route::post('/help/articles/{slug}/feedback', [PublicHelpController::class, 'feedback'])->name('public.help.feedback');
    Route::post('/help/tickets', [PublicTicketController::class, 'store'])->name('public.tickets.store');
});

// Customer-facing ticket API consumed only by the main application
// (web/backend). Authenticated via the shared internal token + the customer
// email supplied by the caller.
Route::prefix('customer/tickets')
    ->middleware(['internal', 'throttle:public'])
    ->group(function () {
        Route::get('/categories', [PublicCustomerTicketController::class, 'categories'])->name('customer.tickets.categories');
        Route::get('/', [PublicCustomerTicketController::class, 'index'])->name('customer.tickets.index');
        Route::post('/', [PublicCustomerTicketController::class, 'store'])->name('customer.tickets.store');
        Route::get('/{ticket}', [PublicCustomerTicketController::class, 'show'])->name('customer.tickets.show');
        Route::post('/{ticket}/reply', [PublicCustomerTicketController::class, 'reply'])->name('customer.tickets.reply');
        Route::post('/{ticket}/status', [PublicCustomerTicketController::class, 'status'])->name('customer.tickets.status');
        Route::post('/{ticket}/rate', [PublicCustomerTicketController::class, 'rate'])->name('customer.tickets.rate');
    });

// Webhook ingest from the main application. Simple token validation is not
// enough here — events travel from the platform, so we enforce the full signed
// handshake: token + timestamp within a replay window + one-use nonce + rate
// limit. Events are stored idempotently (event_id) and may auto-raise tickets.
Route::prefix('internal/events')
    ->middleware(['internal.signed', 'throttle:public'])
    ->group(function () {
        Route::post('/', [SupportEventController::class, 'store'])->name('internal.events.store');
        Route::get('/{eventId}', [SupportEventController::class, 'show'])->name('internal.events.show');
    });

RateLimiter::for('public', fn () => Limit::perMinute(120)->by(optional(request()->user())->id ?: request()->ip()));

// ── Staff identity API ───────────────────────────────────────────
// Staff-only. Login is rate limited per IP and per email, and locked per account
// (see StaffAuthenticator). Account management requires an active super admin.
Route::prefix('staff')->group(function () {
    Route::post('/login', [StaffLoginController::class, 'login'])
        ->middleware('throttle:staff-api-login')
        ->name('api.staff.login');

    Route::post('/logout', [StaffLoginController::class, 'logout'])
        ->middleware('auth:staff_api')
        ->name('api.staff.logout');
});

Route::prefix('admin/staff')
    ->middleware(['auth:staff_api', 'staff.super_admin', 'throttle:staff-admin'])
    ->group(function () {
        Route::get('/', [StaffAccountController::class, 'index'])->name('api.admin.staff.index');
        Route::post('/', [StaffAccountController::class, 'store'])->name('api.admin.staff.store');
        Route::patch('/{staff}', [StaffAccountController::class, 'update'])->name('api.admin.staff.update');
        Route::post('/{staff}/disable', [StaffAccountController::class, 'disable'])->name('api.admin.staff.disable');
        Route::post('/{staff}/enable', [StaffAccountController::class, 'enable'])->name('api.admin.staff.enable');
        Route::post('/{staff}/ads-token', [StaffAdsTokenController::class, 'issue'])->name('api.admin.staff.ads-token');
    });

RateLimiter::for('staff-api-login', fn (Request $request) => [
    Limit::perMinute(20)->by('ip|'.$request->ip()),
    Limit::perMinute(10)->by('email|'.Str::lower((string) $request->input('email')).'|'.$request->ip()),
]);

RateLimiter::for('staff-admin', fn (Request $request) => Limit::perMinute(60)->by(
    optional($request->user('staff_api'))->id ?: $request->ip()
));
