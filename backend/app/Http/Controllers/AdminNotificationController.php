<?php

namespace App\Http\Controllers;

use App\Enums\AdminNotificationCategory;
use App\Models\AdminNotification;
use App\Services\AdminNotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminNotificationController extends Controller
{
    public function __construct(
        protected AdminNotificationService $service
    ) {}

    /**
     * List admin notifications with permission and preference isolation.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $perPage = max(5, min((int) $request->input('per_page', 15), 50));

        $filters = [
            'category' => $request->input('category'),
            'severity' => $request->input('severity'),
            'status' => $request->input('status'), // 'unread', 'read', or null
        ];

        $query = $this->service->queryFor($user, $filters)
            ->with(['reads' => function ($q) use ($user) {
                $q->where('admin_id', $user->id);
            }]);

        $paginator = $query->paginate($perPage);

        // Map items to include a clean boolean is_read field for this admin
        $items = collect($paginator->items())->map(function (AdminNotification $item) use ($user) {
            $isRead = $item->reads->isNotEmpty();
            $data = $item->toArray();
            $data['is_read'] = $isRead;
            unset($data['reads']); // Don't leak other admin read details
            return $data;
        });

        // Compute total unread count across all allowed categories
        $totalUnread = $this->service->queryFor($user, ['status' => 'unread'])->count();

        // Compute category breakdown with unread counts for tab badges
        $allowed = $this->service->allowedCategoriesFor($user);
        $categoriesMeta = [];
        foreach ($allowed as $catKey) {
            $catEnum = AdminNotificationCategory::tryFrom($catKey);
            if ($catEnum) {
                $catUnread = $this->service->queryFor($user, ['category' => $catKey, 'status' => 'unread'])->count();
                $categoriesMeta[] = [
                    'key' => $catKey,
                    'label' => $catEnum->label(),
                    'description' => $catEnum->description(),
                    'unread' => $catUnread,
                ];
            }
        }

        return response()->json([
            'success' => true,
            'data' => $items,
            'unread_count' => $totalUnread,
            'categories' => $categoriesMeta,
            'pagination' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
            ],
        ]);
    }

    /**
     * Mark an admin notification as read.
     */
    public function markRead(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        $allowed = $this->service->allowedCategoriesFor($user);

        $notification = AdminNotification::whereIn('category', $allowed)
            ->where(function ($q) use ($user) {
                $q->whereNull('target_admin_id')->orWhere('target_admin_id', $user->id);
            })
            ->findOrFail($id);

        $this->service->markAsRead($notification, $user);

        $totalUnread = $this->service->queryFor($user, ['status' => 'unread'])->count();

        return response()->json([
            'success' => true,
            'message' => 'Notification marked as read.',
            'unread_count' => $totalUnread,
        ]);
    }

    /**
     * Mark all accessible notifications as read for this admin.
     */
    public function markAllRead(Request $request): JsonResponse
    {
        $user = $request->user();
        $category = $request->input('category');

        $count = $this->service->markAllAsRead($user, $category);

        return response()->json([
            'success' => true,
            'message' => "Marked {$count} notifications as read.",
            'unread_count' => 0,
        ]);
    }

    /**
     * Get notification preferences for the authenticated admin.
     */
    public function getPreferences(Request $request): JsonResponse
    {
        $user = $request->user();
        $prefs = $this->service->getPreferences($user);
        $metadata = AdminNotificationCategory::metadata();

        return response()->json([
            'success' => true,
            'data' => $prefs,
            'metadata' => $metadata,
        ]);
    }

    /**
     * Update notification preferences for the authenticated admin.
     */
    public function updatePreferences(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'preferences' => ['required', 'array'],
            'preferences.*.category' => ['required', 'string'],
            'preferences.*.channel' => ['required', 'string', 'in:in_app,email,telegram'],
            'preferences.*.enabled' => ['required', 'boolean'],
        ]);

        $this->service->updatePreferences($request->user(), $validated['preferences']);

        return response()->json([
            'success' => true,
            'message' => 'Admin notification preferences updated.',
            'data' => $this->service->getPreferences($request->user()),
        ]);
    }
}
