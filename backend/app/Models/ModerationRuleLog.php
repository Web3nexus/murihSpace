<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One rule match against one piece of content.
 *
 * Kept separate from `reports` so that rule telemetry survives a moderator
 * dismissing the report, and so a rule can be tuned against its own history
 * without reading moderation decisions.
 */
class ModerationRuleLog extends Model
{
    public const ACTION = 'flagged';

    protected $fillable = [
        'rule_id',
        'report_id',
        'content_type',
        'content_id',
        'author_id',
        'matched_pattern',
        'snippet',
        'action',
    ];

    protected $casts = [
        'action' => 'string',
    ];

    public function rule(): BelongsTo
    {
        return $this->belongsTo(ModerationRule::class, 'rule_id');
    }

    public function report(): BelongsTo
    {
        return $this->belongsTo(Report::class, 'report_id');
    }

    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'author_id');
    }
}
