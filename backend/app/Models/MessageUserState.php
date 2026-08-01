<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MessageUserState extends Model
{
    protected $fillable = [
        'message_id', 'user_id', 'is_hidden', 'is_reported',
    ];

    protected $casts = [
        'is_hidden' => 'boolean',
        'is_reported' => 'boolean',
    ];

    public function message()
    {
        return $this->belongsTo(Message::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
