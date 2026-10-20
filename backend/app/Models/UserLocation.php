<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UserLocation extends Model
{
    /** Users within this distance count as "nearby" for suggestions. */
    public const NEARBY_KM = 50;

    protected $fillable = [
        'user_id',
        'sharing_enabled',
        'latitude',
        'longitude',
        'captured_at',
    ];

    protected $casts = [
        'sharing_enabled' => 'boolean',
        'latitude' => 'float',
        'longitude' => 'float',
        'captured_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** Whether this user has a usable, shared position. */
    public function isShared(): bool
    {
        return $this->sharing_enabled && $this->latitude !== null && $this->longitude !== null;
    }

    /** Great-circle distance in kilometres between two coordinate pairs. */
    public static function distanceKm(float $lat1, float $lng1, float $lat2, float $lng2): float
    {
        $earthRadius = 6371.0;
        $dLat = deg2rad($lat2 - $lat1);
        $dLng = deg2rad($lng2 - $lng1);
        $a = sin($dLat / 2) ** 2
            + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLng / 2) ** 2;

        return 2 * $earthRadius * asin(min(1.0, sqrt($a)));
    }
}
