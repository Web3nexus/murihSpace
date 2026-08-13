<?php

use App\Http\Controllers\SecureCrm\SecureCrmAnnouncementController;
use App\Http\Controllers\SecureCrm\SecureCrmAutomationController;
use App\Http\Controllers\SecureCrm\SecureCrmCmsController;
use App\Http\Controllers\SecureCrm\SecureCrmCustomerController;
use App\Http\Controllers\SecureCrm\SecureCrmHelpController;
use App\Http\Controllers\SecureCrm\SecureCrmLoginController;
use App\Http\Controllers\SecureCrm\SecureCrmMacroController;
use App\Http\Controllers\SecureCrm\SecureCrmNotificationController;
use App\Http\Controllers\SecureCrm\SecureCrmOverviewController;
use App\Http\Controllers\SecureCrm\SecureCrmReportsController;
use App\Http\Controllers\SecureCrm\SecureCrmSectionController;
use App\Http\Controllers\SecureCrm\SecureCrmSlaController;
use App\Http\Controllers\SecureCrm\SecureCrmTeamController;
use App\Http\Controllers\SecureCrm\SecureCrmTicketController;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Route;

Route::redirect('/', '/securecrm/login');

// ── Staff authentication (SecureCRM) ─────────────────────────────
Route::middleware('guest:staff')->group(function () {
    Route::get('/securecrm/login', [SecureCrmLoginController::class, 'showLogin'])
        ->middleware('throttle:staff-login')
        ->name('securecrm.login');

    Route::post('/securecrm/login', [SecureCrmLoginController::class, 'login'])
        ->middleware('throttle:staff-login')
        ->name('securecrm.login.submit');
});

Route::post('/securecrm/logout', [SecureCrmLoginController::class, 'logout'])
    ->middleware('staff')
    ->name('securecrm.logout');

// ── SecureCRM dashboard (staff only) ─────────────────────────────
Route::prefix('securecrm')->middleware('staff')->group(function () {
    Route::get('/', fn () => redirect()->route('securecrm.overview'))->name('securecrm.index');
    Route::get('/overview', SecureCrmOverviewController::class)->name('securecrm.overview');

    Route::get('/reports', SecureCrmReportsController::class)
        ->middleware('staff.permission:report.view')
        ->name('securecrm.reports');

    Route::get('/notifications', [SecureCrmNotificationController::class, 'index'])->name('securecrm.notifications');
    Route::post('/notifications/{notification}/read', [SecureCrmNotificationController::class, 'markRead'])->name('securecrm.notifications.read');
    Route::post('/notifications/read-all', [SecureCrmNotificationController::class, 'markAllRead'])->name('securecrm.notifications.read-all');

    // Tickets (dedicated controller; section permission = ticket.view)
    Route::middleware('staff.permission:ticket.view')->group(function () {
        Route::get('/tickets', [SecureCrmTicketController::class, 'index'])->name('securecrm.tickets');
        Route::get('/tickets/create', [SecureCrmTicketController::class, 'create'])
            ->middleware('staff.permission:ticket.create')
            ->name('securecrm.tickets.create');
        Route::post('/tickets', [SecureCrmTicketController::class, 'store'])
            ->middleware('staff.permission:ticket.create')
            ->name('securecrm.tickets.store');
        Route::get('/tickets/{ticket}', [SecureCrmTicketController::class, 'show'])->name('securecrm.tickets.show');

        // Conversation actions
        Route::post('/tickets/{ticket}/reply', [SecureCrmTicketController::class, 'reply'])
            ->middleware('staff.permission:ticket.reply')
            ->name('securecrm.tickets.reply');
        Route::post('/tickets/{ticket}/note', [SecureCrmTicketController::class, 'note'])
            ->middleware('staff.permission:ticket.note')
            ->name('securecrm.tickets.note');
        Route::post('/tickets/{ticket}/status', [SecureCrmTicketController::class, 'status'])
            ->middleware('staff.permission:ticket.close')
            ->name('securecrm.tickets.status');
        Route::post('/tickets/{ticket}/assign', [SecureCrmTicketController::class, 'assign'])
            ->middleware('staff.permission:ticket.assign')
            ->name('securecrm.tickets.assign');
        Route::post('/tickets/{ticket}/escalate', [SecureCrmTicketController::class, 'escalate'])
            ->middleware('staff.permission:ticket.escalate')
            ->name('securecrm.tickets.escalate');
        Route::post('/tickets/{ticket}/macro/{macro}', [SecureCrmTicketController::class, 'applyMacro'])
            ->middleware('staff.permission:ticket.reply')
            ->name('securecrm.tickets.macro');
    });

    // Macros (dedicated controller; section permission = macro.manage)
    Route::middleware('staff.permission:macro.manage')->group(function () {
        Route::get('/macros', [SecureCrmMacroController::class, 'index'])->name('securecrm.macros');
        Route::post('/macros', [SecureCrmMacroController::class, 'store'])->name('securecrm.macros.store');
        Route::patch('/macros/{macro}', [SecureCrmMacroController::class, 'update'])->name('securecrm.macros.update');
        Route::post('/macros/{macro}/toggle', [SecureCrmMacroController::class, 'toggle'])->name('securecrm.macros.toggle');
        Route::delete('/macros/{macro}', [SecureCrmMacroController::class, 'destroy'])->name('securecrm.macros.destroy');
    });

    // Automation (dedicated controller; view for rules+logs, manage for changes)
    Route::middleware('staff.permission:automation.view')->group(function () {
        Route::get('/automation', [SecureCrmAutomationController::class, 'index'])->name('securecrm.automation');

        Route::middleware('staff.permission:automation.manage')->group(function () {
            Route::post('/automation', [SecureCrmAutomationController::class, 'store'])->name('securecrm.automation.store');
            Route::patch('/automation/{rule}', [SecureCrmAutomationController::class, 'update'])->name('securecrm.automation.update');
            Route::post('/automation/{rule}/toggle', [SecureCrmAutomationController::class, 'toggle'])->name('securecrm.automation.toggle');
            Route::delete('/automation/{rule}', [SecureCrmAutomationController::class, 'destroy'])->name('securecrm.automation.destroy');
            Route::post('/automation/{rule}/preview', [SecureCrmAutomationController::class, 'preview'])->name('securecrm.automation.preview');
        });
    });

    // SLAs (dedicated controller; section permission = sla.manage)
    Route::middleware('staff.permission:sla.manage')->group(function () {
        Route::get('/slas', [SecureCrmSlaController::class, 'index'])->name('securecrm.slas');
        Route::post('/slas', [SecureCrmSlaController::class, 'store'])->name('securecrm.slas.store');
        Route::patch('/slas/{policy}', [SecureCrmSlaController::class, 'update'])->name('securecrm.slas.update');
        Route::post('/slas/{policy}/toggle', [SecureCrmSlaController::class, 'toggle'])->name('securecrm.slas.toggle');
        Route::delete('/slas/{policy}', [SecureCrmSlaController::class, 'destroy'])->name('securecrm.slas.destroy');
    });

    // Support teams (dedicated controller; section permission = team.manage)
    Route::middleware('staff.permission:team.manage')->group(function () {
        Route::get('/teams', [SecureCrmTeamController::class, 'index'])->name('securecrm.teams');
        Route::post('/teams', [SecureCrmTeamController::class, 'store'])->name('securecrm.teams.store');
        Route::patch('/teams/{team}', [SecureCrmTeamController::class, 'update'])->name('securecrm.teams.update');
        Route::post('/teams/{team}/toggle', [SecureCrmTeamController::class, 'toggle'])->name('securecrm.teams.toggle');
        Route::delete('/teams/{team}', [SecureCrmTeamController::class, 'destroy'])->name('securecrm.teams.destroy');
        Route::get('/teams/{team}/queue', [SecureCrmTeamController::class, 'queue'])->name('securecrm.teams.queue');
        Route::post('/teams/{team}/members', [SecureCrmTeamController::class, 'members'])->name('securecrm.teams.members');
        Route::patch('/agents/{agent}/availability', [SecureCrmTeamController::class, 'availability'])->name('securecrm.teams.availability');
        Route::post('/teams/tickets/{ticket}/assign', [SecureCrmTeamController::class, 'assignTicket'])->name('securecrm.teams.tickets.assign');
    });

    // Customers (dedicated controller; section permission = customer.summary.view)
    Route::middleware('staff.permission:customer.summary.view')->group(function () {
        Route::get('/customers', [SecureCrmCustomerController::class, 'index'])->name('securecrm.customers');
        Route::get('/customers/{email}', [SecureCrmCustomerController::class, 'show'])->where('email', '.*')->name('securecrm.customers.show');
        Route::post('/customers/{email}/notes', [SecureCrmCustomerController::class, 'storeNote'])
            ->middleware('staff.permission:customer.notes.create')
            ->where('email', '.*')
            ->name('securecrm.customers.notes.store');
    });

    // Help Center CMS (dedicated controller; section permission = help.article.view)
    Route::middleware('staff.permission:help.article.view')->group(function () {
        Route::get('/help', [SecureCrmHelpController::class, 'index'])->name('securecrm.help');
        Route::get('/help/categories', [SecureCrmHelpController::class, 'categories'])->name('securecrm.help.categories');

        Route::middleware('staff.permission:help.article.create')->group(function () {
            Route::get('/help/create', [SecureCrmHelpController::class, 'create'])->name('securecrm.help.create');
            Route::post('/help', [SecureCrmHelpController::class, 'store'])->name('securecrm.help.store');
        });

        Route::get('/help/{article}', [SecureCrmHelpController::class, 'show'])->name('securecrm.help.show');
        Route::get('/help/{article}/preview', [SecureCrmHelpController::class, 'preview'])->name('securecrm.help.preview');

        Route::middleware('staff.permission:help.article.edit')->group(function () {
            Route::get('/help/{article}/edit', [SecureCrmHelpController::class, 'edit'])->name('securecrm.help.edit');
            Route::patch('/help/{article}', [SecureCrmHelpController::class, 'update'])->name('securecrm.help.update');
            Route::post('/help/{article}/revisions/{revision}/restore', [SecureCrmHelpController::class, 'restoreRevision'])->name('securecrm.help.revisions.restore');
            Route::post('/help/{article}/attachments', [SecureCrmHelpController::class, 'storeAttachment'])->name('securecrm.help.attachments.store');
            Route::delete('/help/attachments/{attachment}', [SecureCrmHelpController::class, 'destroyAttachment'])->name('securecrm.help.attachments.destroy');
        });

        Route::middleware('staff.permission:help.article.publish')->group(function () {
            Route::post('/help/{article}/publish', [SecureCrmHelpController::class, 'publish'])->name('securecrm.help.publish');
            Route::post('/help/{article}/unpublish', [SecureCrmHelpController::class, 'unpublish'])->name('securecrm.help.unpublish');
            Route::post('/help/{article}/schedule', [SecureCrmHelpController::class, 'schedule'])->name('securecrm.help.schedule');
        });

        Route::middleware('staff.permission:help.article.archive')->group(function () {
            Route::post('/help/{article}/archive', [SecureCrmHelpController::class, 'archive'])->name('securecrm.help.archive');
            Route::post('/help/{article}/restore', [SecureCrmHelpController::class, 'restore'])->name('securecrm.help.restore');
        });

        // Categories (edit permission for mutations)
        Route::middleware('staff.permission:help.article.edit')->group(function () {
            Route::post('/help/categories', [SecureCrmHelpController::class, 'storeCategory'])->name('securecrm.help.categories.store');
            Route::patch('/help/categories/{category}', [SecureCrmHelpController::class, 'updateCategory'])->name('securecrm.help.categories.update');
            Route::delete('/help/categories/{category}', [SecureCrmHelpController::class, 'destroyCategory'])->name('securecrm.help.categories.destroy');
        });

        Route::get('/help/attachments/{attachment}/download', [SecureCrmHelpController::class, 'downloadAttachment'])->name('securecrm.help.attachments.download');
    });

    // Website CMS (dedicated controller; section permission = cms.view)
    Route::middleware('staff.permission:cms.view')->group(function () {
        Route::get('/cms', [SecureCrmCmsController::class, 'index'])->name('securecrm.cms');

        Route::middleware('staff.permission:cms.edit')->group(function () {
            Route::get('/cms/create', [SecureCrmCmsController::class, 'create'])->name('securecrm.cms.create');
            Route::post('/cms', [SecureCrmCmsController::class, 'store'])->name('securecrm.cms.store');
            Route::get('/cms/{cms}/edit', [SecureCrmCmsController::class, 'edit'])->name('securecrm.cms.edit');
            Route::patch('/cms/{cms}', [SecureCrmCmsController::class, 'update'])->name('securecrm.cms.update');
            Route::post('/cms/{cms}/revisions/{revision}/restore', [SecureCrmCmsController::class, 'restoreRevision'])->name('securecrm.cms.revisions.restore');
        });

        Route::get('/cms/{cms}', [SecureCrmCmsController::class, 'show'])->name('securecrm.cms.show');
        Route::get('/cms/{cms}/preview', [SecureCrmCmsController::class, 'preview'])->name('securecrm.cms.preview');

        Route::middleware('staff.permission:cms.publish')->group(function () {
            Route::post('/cms/{cms}/publish', [SecureCrmCmsController::class, 'publish'])->name('securecrm.cms.publish');
            Route::post('/cms/{cms}/unpublish', [SecureCrmCmsController::class, 'unpublish'])->name('securecrm.cms.unpublish');
            Route::post('/cms/{cms}/schedule', [SecureCrmCmsController::class, 'schedule'])->name('securecrm.cms.schedule');
            Route::post('/cms/{cms}/archive', [SecureCrmCmsController::class, 'archive'])->name('securecrm.cms.archive');
            Route::post('/cms/{cms}/restore', [SecureCrmCmsController::class, 'restore'])->name('securecrm.cms.restore');
        });
    });

    // Announcements (dedicated controller; section permission = announcement.view)
    Route::middleware('staff.permission:announcement.view')->group(function () {
        Route::get('/announcements', [SecureCrmAnnouncementController::class, 'index'])->name('securecrm.announcements');

        Route::middleware('staff.permission:announcement.manage')->group(function () {
            Route::get('/announcements/create', [SecureCrmAnnouncementController::class, 'create'])->name('securecrm.announcements.create');
            Route::post('/announcements', [SecureCrmAnnouncementController::class, 'store'])->name('securecrm.announcements.store');
            Route::get('/announcements/{announcement}/edit', [SecureCrmAnnouncementController::class, 'edit'])->name('securecrm.announcements.edit');
            Route::patch('/announcements/{announcement}', [SecureCrmAnnouncementController::class, 'update'])->name('securecrm.announcements.update');
            Route::post('/announcements/{announcement}/publish', [SecureCrmAnnouncementController::class, 'publish'])->name('securecrm.announcements.publish');
            Route::post('/announcements/{announcement}/unpublish', [SecureCrmAnnouncementController::class, 'unpublish'])->name('securecrm.announcements.unpublish');
            Route::post('/announcements/{announcement}/schedule', [SecureCrmAnnouncementController::class, 'schedule'])->name('securecrm.announcements.schedule');
            Route::post('/announcements/{announcement}/archive', [SecureCrmAnnouncementController::class, 'archive'])->name('securecrm.announcements.archive');
            Route::post('/announcements/{announcement}/restore', [SecureCrmAnnouncementController::class, 'restore'])->name('securecrm.announcements.restore');
            Route::delete('/announcements/{announcement}', [SecureCrmAnnouncementController::class, 'destroy'])->name('securecrm.announcements.destroy');
        });
    });

    $sections = [
        'crm',
        'knowledge', 'agents',
        'integrations', 'audit', 'settings',
    ];

    foreach ($sections as $section) {
        $permission = config("staff.section_permissions.{$section}");
        $middleware = $permission ? ['staff', "staff.permission:{$permission}"] : ['staff'];

        Route::get("/{$section}", SecureCrmSectionController::class)
            ->middleware($middleware)
            ->defaults('section', $section)
            ->name("securecrm.{$section}");
    }
});

RateLimiter::for('staff-login', fn () => Limit::perMinute(10)->by(request()->ip()));
