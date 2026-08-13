<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AdLedgerTransaction extends Model
{
    protected $fillable = ['ad_wallet_id', 'amount', 'type', 'reference_type', 'reference_id', 'description'];
}
