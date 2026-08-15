<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Product extends Model
{
    protected $fillable = [
        'product_catalog_id',
        'retailer_product_id',
        'name',
        'description',
        'image_url',
        'product_url',
        'price',
        'currency',
        'in_stock'
    ];

    public function catalog()
    {
        return $this->belongsTo(ProductCatalog::class, 'product_catalog_id');
    }
}
