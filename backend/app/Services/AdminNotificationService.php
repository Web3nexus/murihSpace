<?php

namespace App\Services;

use App\Enums\AdminNotificationCategory;
use App\Enums\AdminPermission;
use App\Events\AdminNotificationBroadcast;
use App\Models\AdminNotification;
use App\Models\AdminNotificationPreference;
use App\Models\AdminNotificationRead;
use App\Models\User;
use App\Support\AdminPermissionMatrix;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;

class AdminNotificationService
{
    /**
     * Dispatch a new admin-only notification.
     *
     * @param  array{
     *     category: string,
     *     title: string,
     *     message: string,
     *     severity?: string,
     *     action_url?: string|null,
     *     reference_id?: string|null,
     *     reference_type?: string|null,
     *     metadata?: array|null,
     *     target_role?: string|null,
     *     target_admin_id?: int|null
     * }  $data
     */
    public function dispatch(array $data): AdminNotification
    {
        $category = $data['category'] ?? '';
        $validCategories = AdminNotificationCategory::values();

        if (! in_array($category, $validCategories, true)) {
            $category = AdminNotificationCategory::SystemAlerts->value;
        }

        $notification = AdminNotification::create([
            'category' => $category,
            'severity' => $data['severity'] ?? 'info',
            'title' => $this->sanitizeText($data['title'] ?? 'System Notice'),
            'message' => $this->sanitizeText($data['message'] ?? ''),
            'action_url' => $data['action_url'] ?? null,
            'reference_id' => isset($data['reference_id']) ? (string) $data['reference_id'] : null,
            'reference_type' => $data['reference_type'] ?? null,
            'metadata' => $data['metadata'] ?? null,
            'target_role' => $data['target_role'] ?? null,
            'target_admin_id' => $data['target_admin_id'] ?? null,
        ]);

        // Broadcast securely on isolated admin channel
        try {
            event(new AdminNotificationBroadcast(
                notification: [
                    'id' => $notification->id,
                    'category' => $notification->category,
                    'severity' => $notification->severity,
                    'title' => $notification->title,
                    'message' => $notification->message,
                    'action_url' => $notification->action_url,
                    'reference_id' => $notification->reference_id,
                    'reference_type' => $notification->reference_type,
                    'metadata' => $notification->metadata,
                    'created_at' => $notification->created_at?->toIso8601String(),
                ],
                targetAdminId: $notification->target_admin_id,
                category: $notification->category,
            ));
        } catch (\Throwable $e) {
            // Broadcasting failure should not roll back database recording
        }

        return $notification;
    }

    /**
     * Resolve the notification categories this admin is authorized to see.
     * Enforces Section 18 strict authorization at the database layer.
     *
     * @return array<int, string>
     */
    public function allowedCategoriesFor(User $admin): array
    {
        if (! $admin->isAdmin()) {
            return [];
        }

        if ($admin->isSuperAdmin()) {
            return AdminNotificationCategory::values();
        }

        $effective = AdminPermissionMatrix::effectiveNamesFor($admin);
        $allowed = [];

        foreach (AdminNotificationCategory::cases() as $case) {
            $required = $case->requiredPermissions();
            // If no specific permission required or admin holds any of the required permissions
            if (empty($required) || ! empty(array_intersect($required, $effective))) {
                $allowed[] = $case->value;
            }
        }

        return $allowed;
    }

    /**
     * Build an authorized query for an admin.
     * Automatically filters by permissions, preferences, and target admin scoping.
     */
    public function queryFor(User $admin, array $filters = []): Builder
    {
        $allowedCategories = $this->allowedCategoriesFor($admin);

        if (empty($allowedCategories)) {
            // Admin holds no permissions; return an empty query
            return AdminNotification::whereRaw('1 = 0');
        }

        // Check if admin has disabled specific categories for in-app channel
        $disabledCategories = AdminNotificationPreference::where('admin_id', $admin->id)
            ->where('channel', 'in_app')
            ->where('enabled', false)
            ->pluck('category')
            ->toArray();

        $activeCategories = array_values(array_diff($allowedCategories, $disabledCategories));

        if (empty($activeCategories)) {
            return AdminNotification::whereRaw('1 = 0');
        }

        $query = AdminNotification::query()
            ->whereIn('category', $activeCategories)
            ->where(function (Builder $q) use ($admin) {
                $q->whereNull('target_admin_id')
                    ->orWhere('target_admin_id', $admin->id);
            });

        // Specific category filter requested
        if (! empty($filters['category'])) {
            if (in_array($filters['category'], $activeCategories, true)) {
                $query->where('category', $filters['category']);
            } else {
                return AdminNotification::whereRaw('1 = 0');
            }
        }

        // Severity filter
        if (! empty($filters['severity'])) {
            $query->where('severity', $filters['severity']);
        }

        // Read / Unread status filter
        if (! empty($filters['status'])) {
            if ($filters['status'] === 'unread') {
                $query->whereDoesntHave('reads', function (Builder $q) use ($admin) {
                    $q->where('admin_id', $admin->id);
                });
            } elseif ($filters['status'] === 'read') {
                $query->whereHas('reads', function (Builder $q) use ($admin) {
                    $q->where('admin_id', $admin->id);
                });
            }
        }

        return $query->latest();
    }

    /**
     * Mark an admin notification as read by the given admin.
     */
    public function markAsRead(AdminNotification $notification, User $admin): void
    {
        AdminNotificationRead::firstOrCreate([
            'admin_id' => $admin->id,
            'admin_notification_id' => $notification->id,
        ], [
            'read_at' => now(),
        ]);
    }

    /**
     * Mark all accessible notifications as read for this admin.
     */
    public function markAllAsRead(User $admin, ?string $category = null): int
    {
        $query = $this->queryFor($admin, ['category' => $category, 'status' => 'unread']);
        $unreadIds = $query->pluck('id');

        $now = now();
        $inserts = [];
        foreach ($unreadIds as $id) {
            $inserts[] = [
                'admin_id' => $admin->id,
                'admin_notification_id' => $id,
                'read_at' => $now,
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }

        if (! empty($inserts)) {
            AdminNotificationRead::upsert(
                $inserts,
                ['admin_id', 'admin_notification_id'],
                ['read_at', 'updated_at']
            );
        }

        return count($inserts);
    }

    /**
     * Get preference map for an admin across all categories and channels.
     *
     * @return array<string, array<string, bool>>
     */
    public function getPreferences(User $admin): array
    {
        $allowed = $this->allowedCategoriesFor($admin);
        $records = AdminNotificationPreference::where('admin_id', $admin->id)->get();

        $map = [];
        foreach ($allowed as $cat) {
            foreach (AdminNotificationPreference::CHANNELS as $ch) {
                $map[$cat][$ch] = true; // Default enabled
            }
        }

        foreach ($records as $record) {
            if (isset($map[$record->category][$record->channel])) {
                $map[$record->category][$record->channel] = (bool) $record->enabled;
            }
        }

        return $map;
    }

    /**
     * Update preference toggles for an admin.
     *
     * @param  array<int, array{category: string, channel: string, enabled: bool}>  $preferences
     */
    public function updatePreferences(User $admin, array $preferences): void
    {
        $allowed = $this->allowedCategoriesFor($admin);
        $channels = AdminNotificationPreference::CHANNELS;

        DB::transaction(function () use ($admin, $preferences, $allowed, $channels) {
            foreach ($preferences as $pref) {
                $category = $pref['category'] ?? '';
                $channel = $pref['channel'] ?? '';
                $enabled = (bool) ($pref['enabled'] ?? true);

                if (! in_array($category, $allowed, true) || ! in_array($channel, $channels, true)) {
                    continue;
                }

                AdminNotificationPreference::updateOrCreate(
                    [
                        'admin_id' => $admin->id,
                        'category' => $category,
                        'channel' => $channel,
                    ],
                    [
                        'enabled' => $enabled,
                    ]
                );
            }
        });
    }

    /**
     * Sanitize message/title to avoid leaking raw credentials, OTPs, or credit card numbers.
     */
    protected function sanitizeText(string $text): string
    {
        $redacted = $text;
        // Redact OTPs, cards, secrets, tokens
        $redacted = preg_replace('/\b\d{6}\b/', '[code]', $redacted) ?? $redacted;
        $redacted = preg_replace('/\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/', '[card redacted]', $redacted) ?? $redacted;
        $redacted = preg_replace('/(password|secret|token|api_key)\s*[:=]\s*[^\s,;]+/i', '$1: [redacted]', $redacted) ?? $redacted;

        return trim($redacted);
    }
}
