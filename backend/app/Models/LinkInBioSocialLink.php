<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LinkInBioSocialLink extends Model
{
    protected $fillable = ['user_id', 'platform', 'url', 'sort_order'];

    protected $casts = ['sort_order' => 'integer'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
