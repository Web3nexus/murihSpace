<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AutomationRule extends Model
{
    use HasFactory;

    public const TRIGGERS = ['created', 'updated', 'all'];

    public const CONDITION_FIELDS = [
        'category_id', 'category', 'priority', 'status', 'channel',
        'subject', 'description', 'keyword', 'customer_email',
    ];

    public const CONDITION_OPERATORS = [
        'equals', 'not_equals', 'contains', 'not_contains',
        'in', 'not_in', 'gt', 'lt', 'is_empty', 'not_empty',
    ];

    public const ACTION_TYPES = [
        'set_priority', 'set_status', 'assign_agent', 'assign_team',
        'set_category', 'add_note', 'notify_staff',
    ];

    protected $fillable = [
        'name', 'description', 'trigger', 'conditions', 'actions',
        'sort_order', 'enabled', 'stop_after_match', 'created_by',
        'last_triggered_at', 'times_triggered',
    ];

    protected $casts = [
        'conditions' => 'array',
        'actions' => 'array',
        'enabled' => 'boolean',
        'stop_after_match' => 'boolean',
        'sort_order' => 'integer',
        'last_triggered_at' => 'datetime',
        'times_triggered' => 'integer',
    ];

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(StaffUser::class, 'created_by');
    }

    public function logs(): HasMany
    {
        return $this->hasMany(AutomationRuleLog::class, 'rule_id');
    }

    public function shouldRunFor(?string $trigger): bool
    {
        if (! $this->enabled) {
            return false;
        }

        if ($trigger === null) {
            return true;
        }

        return in_array($this->trigger, [$trigger, 'all'], true);
    }
}
