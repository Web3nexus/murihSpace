<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Laravel\Scout\Searchable;

class Message extends Model
{
    use Searchable, SoftDeletes;

    protected $fillable = [
        'conversation_id',
        'user_id',
        'content',
        'type',
        'status',
        'media_status',
        'client_uuid',
        'reply_to_id',
        'forwarded_from_message_id',
        'attachment_url',
        'attachment_type',
        'media_id',
        'edited_at',
    ];

    protected $casts = [
        'edited_at' => 'datetime',
    ];

    public const STATUS_SENDING = 'sending';
    public const STATUS_SENT = 'sent';
    public const STATUS_FAILED = 'failed';
    public const STATUS_DELETED = 'deleted';

    public const MEDIA_STATUS_UPLOADING = 'uploading';
    public const MEDIA_STATUS_PROCESSING = 'processing';
    public const MEDIA_STATUS_READY = 'ready';
    public const MEDIA_STATUS_FAILED = 'failed';
    public const MEDIA_STATUS_REJECTED = 'rejected';

    public function conversation(): BelongsTo
    {
        return $this->belongsTo(Conversation::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function replyTo(): BelongsTo
    {
        return $this->belongsTo(Message::class, 'reply_to_id');
    }

    public function forwardedFrom(): BelongsTo
    {
        return $this->belongsTo(Message::class, 'forwarded_from_message_id');
    }

    public function media(): BelongsTo
    {
        return $this->belongsTo(Media::class);
    }

    public function reactions(): HasMany
    {
        return $this->hasMany(MessageReaction::class);
    }

    public function userStates(): HasMany
    {
        return $this->hasMany(MessageUserState::class);
    }

    public function scopeNotHiddenForUser($query, int $userId)
    {
        return $query->whereDoesntHave('userStates', fn ($q) => $q->where('user_id', $userId)->where('is_hidden', true));
    }

    public function scopeVisible($query)
    {
        return $query->whereNull('deleted_at')->where('status', '!=', self::STATUS_DELETED);
    }

    public function isDeletedForEveryone(): bool
    {
        return $this->trashed() || $this->status === self::STATUS_DELETED;
    }

    public function isReady(): bool
    {
        if ($this->media_id && $this->media_status !== self::MEDIA_STATUS_READY) {
            return false;
        }
        return true;
    }

    public function toSearchableArray(): array
    {
        return [
            'id' => $this->id,
            'content' => $this->content,
            'conversation_id' => $this->conversation_id,
        ];
    }
}
