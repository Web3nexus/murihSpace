<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DigitalProduct extends Model
{
    protected $fillable = [
        'creator_id',
        'title',
        'slug',
        'description',
        'cover_url',
        'price',
        'currency',
        'is_free',
        'status',
        'category',
        'file_path',
        'file_original_name',
        'file_mime_type',
        'file_size_bytes',
        'download_count',
    ];

    protected $casts = [
        'is_free'        => 'boolean',
        'price'          => 'decimal:2',
        'file_size_bytes' => 'integer',
        'download_count' => 'integer',
    ];

    public const CATEGORIES = [
        'ebook'    => 'E-Book',
        'template' => 'Template',
        'course'   => 'Course Assets',
        'audio'    => 'Audio & Podcast',
        'graphics' => 'Graphics & Design',
        'other'    => 'Other Asset',
    ];

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'creator_id');
    }
}
