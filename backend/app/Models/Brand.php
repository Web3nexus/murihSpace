<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

class Brand extends Model
{
    protected $fillable = [
        'name', 'slug', 'logo_url', 'website',
        'description', 'industry', 'contact_email', 'is_approved',
    ];

    protected $casts = [
        'is_approved' => 'boolean',
    ];

    protected static function booted(): void
    {
        static::creating(function (self $brand) {
            if (!$brand->slug) {
                $brand->slug = Str::slug($brand->name);
            }
        });
    }

    public function deals(): HasMany
    {
        return $this->hasMany(BrandDeal::class);
    }

    public function scopeApproved($q)
    {
        return $q->where('is_approved', true);
    }
}
