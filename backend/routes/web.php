<?php

use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
});

// Developer preview route for the system email layout — local environments only.
if (app()->environment('local')) {
    Route::get('/email-preview', function () {
        $actionUrl = (string) request('actionUrl', config('app.frontend_url') . '/accept-invitation');

        // Reject non-http(s) schemes (e.g. javascript:) to prevent href injection
        if (! in_array(parse_url($actionUrl, PHP_URL_SCHEME), ['http', 'https'], true)) {
            $actionUrl = config('app.frontend_url');
        }

        return view('emails.layout', [
            'name'        => e(request('name', '')),
            // Allow a styled default title but escape any user-supplied value
            'title'       => request()->has('title')
                ? e(request('title'))
                : 'You\'re invited to join <span style="color:#2563eb">Example Company</span>',
            'body'        => request()->has('body')
                ? e(request('body'))
                : '<strong>Example Company</strong> uses ' . config('app.name') . ' to verify users and manage access. Continue with your invited email address to accept the invitation.',
            'details'     => [
                'Invited email' => 'invited-user@example.com',
            ],
            'actionLabel' => e(request('actionLabel', 'Accept invitation')),
            'actionUrl'   => $actionUrl,
            'footnote'    => e(request('footnote', 'If you weren\'t expecting this invitation, you can safely ignore this email.')),
            'supportEmail' => config('mail.support_address'),
        ]);
    });
}
