<?php

namespace App\Models;

use App\Enums\AdminNotificationCategory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AdminNotificationPreference extends Model
{
    protected $table = 'admin_notification_preferences';

    protected $fillable = [
        'admin_id',
        'category',
        'channel',
        'enabled',
    ];

    protected $casts = [
        'enabled' => 'boolean',
    ];

    public const CHANNELS = ['in_app', 'email', 'telegram'];

    public function admin(): BelongsTo
    {
        return $this->belongsTo(User::class, 'admin_id');
    }
}
