<?php

namespace App\Models;

use App\Enums\AdminNotificationCategory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AdminNotification extends Model
{
    protected $table = 'admin_notifications';

    protected $fillable = [
        'category',
        'severity',
        'title',
        'message',
        'action_url',
        'reference_id',
        'reference_type',
        'metadata',
        'target_role',
        'target_admin_id',
    ];

    protected $casts = [
        'metadata' => 'array',
    ];

    public function targetAdmin(): BelongsTo
    {
        return $this->belongsTo(User::class, 'target_admin_id');
    }

    public function reads(): HasMany
    {
        return $this->hasMany(AdminNotificationRead::class, 'admin_notification_id');
    }

    /**
     * Check if a specific admin has marked this notification as read.
     */
    public function isReadBy(int $adminId): bool
    {
        return $this->reads()->where('admin_id', $adminId)->exists();
    }
}
