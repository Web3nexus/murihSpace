<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class GroupSetting extends Model
{
    use HasFactory;

    protected $fillable = [
        'group_id',
        'post_approval',
        'who_can_post',
        'who_can_chat',
        'who_can_invite',
        'slow_mode_seconds',
        'blocked_keywords',
    ];

    protected $casts = [
        'post_approval' => 'boolean',
        'slow_mode_seconds' => 'integer',
        'blocked_keywords' => 'array',
    ];

    public function group(): BelongsTo
    {
        return $this->belongsTo(Group::class);
    }
}
