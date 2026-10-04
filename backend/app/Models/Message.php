<?php

namespace App\Models;

use App\Services\MessageEditingService;
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
        'is_automated',
        'edited_at',
        'edit_count',
    ];

    protected $casts = [
        'is_automated' => 'boolean',
        'edited_at' => 'datetime',
        'edit_count' => 'integer',
    ];

    /**
     * Computed attributes the client needs to decide whether to offer editing.
     *
     * Listed explicitly because this Laravel version only serialises mutators
     * that are appended, not every `getXAttribute` method on the model.
     */
    protected $appends = [
        'can_edit',
        'edit_deadline_at',
    ];

    public const STATUS_SENDING = 'sending';
    public const STATUS_SENT = 'sent';
    public const STATUS_DELIVERED = 'delivered';
    public const STATUS_READ = 'read';
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

    /**
     * Every retained revision of this message, oldest first.
     */
    public function edits(): HasMany
    {
        return $this->hasMany(MessageEdit::class)->orderBy('id');
    }

    /**
     * Whether this message has ever been edited. Distinct from `edited_at`,
     * which is also set when an edit is rolled back to the original text.
     */
    public function wasEdited(): bool
    {
        return (int) ($this->edit_count ?? 0) > 0;
    }

    /**
     * Whether the *acting* user may still edit this message.
     *
     * Serialized so the client only offers the edit affordance when the server
     * would actually allow it. The API re-checks on write; this is presentation
     * only and is always false for anonymous/queued contexts.
     */
    public function getCanEditAttribute(): bool
    {
        $user = auth()->user();

        return $user instanceof User
            ? app(MessageEditingService::class)->canEdit($this, $user)
            : false;
    }

    /**
     * When editing stops being possible, so the client can show a countdown
     * without duplicating the server's window calculation.
     *
     * Named for the `edit_deadline_at` attribute it exposes.
     */
    public function getEditDeadlineAtAttribute(): ?string
    {
        $deadline = app(MessageEditingService::class)->deadlineFor($this);

        if ($deadline instanceof \Carbon\Carbon) {
            return $deadline->toIso8601String();
        }

        return null;
    }

    public function scopeNotHiddenForUser($query, int $userId)
    {
        return $query->whereDoesntHave('userStates', fn ($q) => $q->where('user_id', $userId)->where('is_hidden', true));
    }

    public function scopeVisible($query)
    {
        return $query->whereNull('deleted_at')
            ->where(function ($q) {
                $q->whereNull('status')->orWhere('status', '!=', self::STATUS_DELETED);
            });
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

    /**
     * Public expiry / hold info for chat media so the UI can show the
     * "Available for X more days" warning and the expired-media placeholder.
     */
    public function getMediaExpiryAttribute(): ?array
    {
        if (! $this->media_id || ! $this->media) {
            return null;
        }

        return app(\App\Services\MediaRetentionService::class)->expirationInfo($this->media);
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
