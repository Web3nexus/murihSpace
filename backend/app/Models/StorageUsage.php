<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class StorageUsage extends Model
{
    protected $table = 'storage_usage';

    protected $fillable = [
        'usable_type', 'usable_id', 'media_type', 'bytes',
    ];

    protected $casts = [
        'bytes' => 'integer',
    ];

    public function usable()
    {
        return $this->morphTo();
    }
}
