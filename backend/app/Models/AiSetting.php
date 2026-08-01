<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class AiSetting extends Model
{
    use HasFactory;

    public const OFF_TOPIC_REDIRECT = 'redirect';
    public const OFF_TOPIC_DECLINE = 'decline';
    public const OFF_TOPIC_FLEXIBLE = 'flexible';

    protected $fillable = [
        'user_id',
        'persona',
        'tone',
        'focus_topics',
        'keep_on_topic',
        'off_topic_mode',
    ];

    protected $casts = [
        'focus_topics' => 'array',
        'keep_on_topic' => 'boolean',
    ];
}
