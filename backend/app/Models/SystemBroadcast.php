<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SystemBroadcast extends Model
{
    use HasFactory;

    protected $fillable = [
        'admin_id',
        'title',
        'body',
        'type',
        'target_audience',
        'action_url',
        'action_label',
        'recipients_count',
        'sent_at',
    ];

    protected $casts = [
        'sent_at' => 'datetime',
        'recipients_count' => 'integer',
    ];

    public function admin(): BelongsTo
    {
        return $this->belongsTo(User::class, 'admin_id');
    }

    public function scopeForAudience($query, ?User $user)
    {
        if (! $user) {
            return $query->where('target_audience', 'all');
        }

        $roles = ['all'];
        if ($user->role === 'creator') {
            $roles[] = 'creators';
        } elseif ($user->role === 'vendor') {
            $roles[] = 'vendors';
        }

        return $query->whereIn('target_audience', $roles);
    }
}

