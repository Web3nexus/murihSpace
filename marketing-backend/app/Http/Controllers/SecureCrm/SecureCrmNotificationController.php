<?php

namespace App\Http\Controllers\SecureCrm;

use App\Http\Controllers\Controller;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;

class SecureCrmNotificationController extends Controller
{
    /**
     * Full notification history for the current staff member.
     */
    public function index(Request $request): View
    {
        $notifications = $request->user('staff')
            ->notifications()
            ->latest()
            ->paginate(20);

        return view('securecrm.notifications.index', [
            'notifications' => $notifications,
        ]);
    }

    /**
     * Mark a single notification as read.
     */
    public function markRead(Request $request, string $notification): RedirectResponse
    {
        $request->user('staff')
            ->notifications()
            ->findOrFail($notification)
            ->markAsRead();

        return back()->with('status', 'Notification marked as read.');
    }

    /**
     * Mark all of the current staff member's notifications as read.
     */
    public function markAllRead(Request $request): RedirectResponse
    {
        $request->user('staff')->unreadNotifications()->update(['read_at' => now()]);

        return back()->with('status', 'All notifications marked as read.');
    }
}
