<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SupportEvent extends Model
{
    use HasFactory;

    public const STATUSES = [
        'received', 'ticket_created', 'ignored',
    ];

    protected $fillable = [
        'event_key',
        'event_id',
        'actor_type',
        'actor_reference',
        'customer_email',
        'payload',
        'status',
        'ticket_number',
        'occurred_at',
    ];

    protected $casts = [
        'payload' => 'array',
        'occurred_at' => 'datetime',
    ];

    public function isActionable(): bool
    {
        return in_array($this->status, ['received', 'ticket_created'], true);
    }
}
