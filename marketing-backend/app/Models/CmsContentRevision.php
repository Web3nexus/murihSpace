<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CmsContentRevision extends Model
{
    protected $fillable = [
        'content_id', 'revision_number',
        'title', 'excerpt', 'body', 'content',
        'seo_title', 'seo_description',
        'created_by_type', 'created_by_id', 'note',
    ];

    protected $casts = [
        'content' => 'array',
    ];
}
