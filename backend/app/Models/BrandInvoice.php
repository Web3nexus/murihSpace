<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BrandInvoice extends Model
{
    protected $fillable = [
        'creator_id', 'brand_deal_id', 'brand_name', 'brand_email',
        'invoice_number', 'amount', 'currency', 'description',
        'status', 'due_date', 'paid_at', 'notes',
    ];

    protected $casts = [
        'amount' => 'integer',
        'due_date' => 'date:Y-m-d',
        'paid_at' => 'datetime',
    ];

    public const STATUSES = ['draft', 'sent', 'paid', 'overdue', 'cancelled'];

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'creator_id');
    }

    public function brandDeal(): BelongsTo
    {
        return $this->belongsTo(BrandDeal::class, 'brand_deal_id');
    }
}
