<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ProductCatalog extends Model
{
    protected $fillable = [
        'advertiser_id',
        'name',
        'currency',
    ];

    public function advertiser()
    {
        return $this->belongsTo(Advertiser::class);
    }

    public function products()
    {
        return $this->hasMany(Product::class);
    }
}
