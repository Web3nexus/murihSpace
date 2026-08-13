<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Announcement extends Model
{
    use HasFactory;

    public const STATES = ['draft', 'published', 'scheduled', 'archived'];

    protected $fillable = [
        'title', 'body', 'state', 'featured',
        'published_at', 'scheduled_at', 'archived_at',
        'created_by_type', 'created_by_id',
    ];

    protected $casts = [
        'featured' => 'boolean',
        'published_at' => 'datetime',
        'scheduled_at' => 'datetime',
        'archived_at' => 'datetime',
    ];

    public function scopePublished($query)
    {
        return $query->where('state', 'published')
            ->where(function ($q) {
                $q->whereNull('published_at')->orWhere('published_at', '<=', now());
            });
    }
}
