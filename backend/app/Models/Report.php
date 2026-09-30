<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Report extends Model
{
    protected $fillable = [
        'reporter_id',
        'reported_type',
        'reported_id',
        'reason',
        'details',
        'status',
        'reviewed_by',
        'review_note',
        'reviewed_at',
        'flagged_by',
        'flagged_at',
        'flag_note',
        'flag_count',
    ];

    protected $casts = [
        'reviewed_at' => 'datetime',
        'flagged_at' => 'datetime',
        'flag_count' => 'integer',
    ];

    /**
     * Extended in DEC-014. `hate_speech`, `violence`, `nudity` and `copyright`
     * are categories a member could already express through the post-report
     * endpoint; folding that path into this table must not cost them the
     * ability to say so.
     */
    public const REASONS = [
        'spam',
        'harassment',
        'hate_speech',
        'violence',
        'nudity',
        'inappropriate',
        'misinformation',
        'copyright',
        'other',
    ];

    public const STATUSES = [
        'pending',
        // Raised by the monitor or by a moderator escalating a report. Still
        // open: `flag` deliberately does not resolve a report.
        'flagged',
        'reviewed',
        'dismissed',
        'actioned',
    ];

    public function reporter(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reporter_id');
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    public function flagger(): BelongsTo
    {
        return $this->belongsTo(User::class, 'flagged_by');
    }

    public function isOpen(): bool
    {
        return in_array($this->status, ['pending', 'flagged'], true);
    }
}
