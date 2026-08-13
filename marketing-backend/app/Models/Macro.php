<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Macro extends Model
{
    use HasFactory;

    /**
     * Actions a macro is allowed to take. Intentionally whitelisted so a
     * simple macro can never trigger unsafe financial actions (refunds,
     * payouts, wallet mutations) — those live outside the macro system.
     */
    public const ACTION_TYPES = [
        'insert_reply',
        'change_status',
        'change_priority',
        'add_tag',
        'assign_team',
    ];

    protected $fillable = [
        'name', 'category', 'body', 'actions', 'created_by', 'is_active',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'actions' => 'array',
    ];

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(StaffUser::class, 'created_by');
    }

    /**
     * Human-readable description of the actions a macro applies, e.g.
     * "Reply · Status → open · Tag kyc".
     */
    public function actionSummary(): string
    {
        $parts = [];

        foreach ($this->actions ?? [] as $action) {
            $type = $action['type'] ?? null;
            $value = $action['value'] ?? null;

            if (! in_array($type, self::ACTION_TYPES, true)) {
                continue;
            }

            $parts[] = match ($type) {
                'insert_reply' => 'Reply',
                'change_status' => 'Status → '.($value ?: '—'),
                'change_priority' => 'Priority → '.($value ?: '—'),
                'add_tag' => 'Tag '.($value ?: '—'),
                'assign_team' => 'Team → '.($value ?: '—'),
                default => $type,
            };
        }

        if ($this->body && trim($this->body) !== '') {
            $parts[] = 'Reply body';
        }

        return $parts === [] ? 'Reply text only' : implode(' · ', $parts);
    }
}
