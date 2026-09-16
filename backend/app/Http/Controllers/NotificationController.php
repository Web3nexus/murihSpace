<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    /**
     * List the authenticated user's in-app notifications (most recent first).
     */
    public function index(Request $request): JsonResponse
    {
        $perPage = (int) $request->input('per_page', 15);
        $perPage = max(5, min($perPage, 50));

        $filter = $request->input('filter', 'all');

        $query = $request->user()->notifications()->latest();

        if ($filter === 'unread') {
            $query = $request->user()->unreadNotifications()->latest();
        }

        $notifications = $query->paginate($perPage);
        $unread = $request->user()->unreadNotifications()->count();
        $totalAll = $request->user()->notifications()->count();

        return response()->json([
            'notifications' => $notifications->items(),
            'data' => $notifications->items(),
            'items' => $notifications->items(),
            'pagination' => [
                'current_page' => $notifications->currentPage(),
                'last_page' => $notifications->lastPage(),
                'per_page' => $notifications->perPage(),
                'total' => $notifications->total(),
            ],
            'total' => $notifications->total(),
            'total_all' => $totalAll,
            'unread' => $unread,
        ]);
    }

    /**
     * Mark a single notification as read.
     */
    public function markRead(Request $request, string $id): JsonResponse
    {
        $notification = $request->user()
            ->notifications()
            ->findOrFail($id);

        $notification->markAsRead();

        return response()->json([
            'message' => 'Marked as read.',
            'unread' => $request->user()->unreadNotifications()->count(),
        ]);
    }

    /**
     * Mark a single notification as unread.
     */
    public function markUnread(Request $request, string $id): JsonResponse
    {
        $notification = $request->user()
            ->notifications()
            ->findOrFail($id);

        $notification->markAsUnread();

        return response()->json([
            'message' => 'Marked as unread.',
            'unread' => $request->user()->unreadNotifications()->count(),
        ]);
    }

    /**
     * Mark all notifications as read.
     */
    public function markAllRead(Request $request): JsonResponse
    {
        $request->user()->unreadNotifications()->update(['read_at' => now()]);

        return response()->json([
            'message' => 'All notifications marked as read.',
            'unread' => 0,
        ]);
    }

    /**
     * Delete a single notification.
     */
    public function destroy(Request $request, string $id): JsonResponse
    {
        $notification = $request->user()
            ->notifications()
            ->findOrFail($id);

        $notification->delete();

        return response()->json([
            'message' => 'Notification deleted.',
            'unread' => $request->user()->unreadNotifications()->count(),
            'total' => $request->user()->notifications()->count(),
        ]);
    }

    /**
     * Delete all notifications for the authenticated user.
     */
    public function destroyAll(Request $request): JsonResponse
    {
        $request->user()->notifications()->delete();

        return response()->json([
            'message' => 'All notifications deleted.',
            'unread' => 0,
            'total' => 0,
        ]);
    }
}
