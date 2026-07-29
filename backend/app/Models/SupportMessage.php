<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SupportMessage extends Model
{
    protected $fillable = ['thread_id', 'user_id', 'content', 'from_admin'];

    protected $casts = ['from_admin' => 'boolean'];

    public function thread(): BelongsTo
    {
        return $this->belongsTo(SupportThread::class, 'thread_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
