<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * A detection rule for the content monitor (DEC-013).
 *
 * Rules are rows rather than configuration so a rule can be tuned or disabled
 * without a deploy, and so a rule's own hit history — how often it fired, how
 * often a human upheld it — is the evidence for whether it is still worth
 * running. `upheld` and `dismissed` are the moderator's verdict on a report the
 * rule created; their ratio is what separates a noisy rule from a broken one.
 */
class ModerationRule extends Model
{
    public const SEVERITIES = ['low', 'medium', 'high'];

    public const CATEGORIES = [
        'hate_speech', 'harassment', 'violence', 'nudity',
        'spam', 'misinformation', 'copyright', 'inappropriate',
    ];

    public const MATCH_TYPES = ['keyword', 'phrase', 'regex'];

    protected $fillable = [
        'name',
        'category',
        'severity',
        'match_type',
        'patterns',
        'applies_to',
        'enabled',
        'times_matched',
        'reports_upheld',
        'reports_dismissed',
    ];

    protected $casts = [
        'patterns' => 'array',
        'applies_to' => 'array',
        'enabled' => 'boolean',
        'times_matched' => 'integer',
        'reports_upheld' => 'integer',
        'reports_dismissed' => 'integer',
    ];

    public function logs(): HasMany
    {
        return $this->hasMany(ModerationRuleLog::class, 'rule_id');
    }

    /**
     * Precision so far: upheld / (upheld + dismissed). Null until a moderator
     * has ruled on at least one report, because "0 of 0 upheld" is not a
     * measure of a rule's quality.
     */
    public function precision(): ?float
    {
        $decided = $this->reports_upheld + $this->reports_dismissed;

        if ($decided === 0) {
            return null;
        }

        return $this->reports_upheld / $decided;
    }

    /**
     * Records a match against this rule.
     */
    public function recordMatch(): void
    {
        $this->increment('times_matched');
    }

    public function recordVerdict(bool $upheld): void
    {
        $upheld
            ? $this->increment('reports_upheld')
            : $this->increment('reports_dismissed');
    }
}
