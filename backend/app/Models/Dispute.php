<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Dispute extends Model
{
    protected $fillable = [
        'escrow_id', 'raised_by', 'reason', 'status',
        'admin_id', 'resolution_note', 'resolved_at',
    ];

    protected $casts = [
        'resolved_at' => 'datetime',
    ];

    public const STATUSES = ['open', 'under_review', 'resolved_buyer', 'resolved_seller', 'cancelled'];

    public function escrow(): BelongsTo
    {
        return $this->belongsTo(Escrow::class);
    }

    public function raisedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'raised_by');
    }

    public function admin(): BelongsTo
    {
        return $this->belongsTo(User::class, 'admin_id');
    }

    public function resolve(string $resolution, int $adminId, string $note = null): void
    {
        $this->update([
            'status' => $resolution,
            'admin_id' => $adminId,
            'resolution_note' => $note,
            'resolved_at' => now(),
        ]);
    }
}
