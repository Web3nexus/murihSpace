<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AutomationRuleLog extends Model
{
    use HasFactory;

    protected $fillable = [
        'rule_id', 'ticket_id', 'matched', 'actions', 'trigger',
    ];

    protected $casts = [
        'matched' => 'boolean',
        'actions' => 'array',
    ];

    public function rule(): BelongsTo
    {
        return $this->belongsTo(AutomationRule::class, 'rule_id');
    }

    public function ticket(): BelongsTo
    {
        return $this->belongsTo(Ticket::class, 'ticket_id');
    }
}
