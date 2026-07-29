<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LinkInBioDesign extends Model
{
    protected $fillable = [
        'user_id', 'theme_id', 'profile_name', 'profile_bio', 'avatar_url', 'banner_url',
        'font', 'button_style', 'layout', 'background_type', 'background_value',
        'bg', 'card_bg', 'text_color', 'accent',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
