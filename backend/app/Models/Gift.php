<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Gift extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'name', 'icon_url', 'animation_url', 'coin_price',
        'creator_earns', 'platform_commission', 'category',
        'is_active', 'sort_order',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'coin_price' => 'integer',
        'creator_earns' => 'integer',
        'platform_commission' => 'integer',
        'sort_order' => 'integer',
    ];

    public const CATEGORIES = ['standard', 'premium', 'limited', 'exclusive'];

    public function scopeActive($query)
    {
        return $query->where('is_active', true)->orderBy('sort_order');
    }

    public function getIconUrlAttribute(?string $value): ?string
    {
        if (empty($value)) {
            return null;
        }
        if (str_starts_with($value, 'http://') || str_starts_with($value, 'https://')) {
            return $value;
        }
        return url($value);
    }

    /**
     * Map a gift's coin price to the animation tier it should trigger.
     *
     * This is the single source of truth used by both the live-stream gift
     * flow (GiftController::send) and the live chat enrichment
     * (LiveStreamController::getMessages) so the same gift always produces the
     * same tier everywhere.
     *
     * Fits the catalog scale (10 → 10,000 coins):
     *   - <= 20  micro       (Love, Legit)
     *   - 21-399 standard    (most gifts)
     *   - 400-999 premium    (Master Key)
     *   - >= 1000 full_screen (Supreme Master, Thoth, King, Cruise, Mansion)
     */
    public static function animationTierFor(int $coinPrice): string
    {
        return match (true) {
            $coinPrice >= 1000 => 'full_screen',
            $coinPrice >= 400 => 'premium',
            $coinPrice <= 20 => 'micro',
            default => 'standard',
        };
    }
}
