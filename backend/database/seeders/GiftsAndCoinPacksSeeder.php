<?php

namespace Database\Seeders;

use App\Models\CoinPack;
use App\Models\Gift;
use Illuminate\Database\Seeder;

class GiftsAndCoinPacksSeeder extends Seeder
{
    public function run(): void
    {
        if (Gift::count() === 0) {
            $gifts = [
                ['name' => 'Rose',        'coin_price' => 1,     'creator_earns' => 1,     'platform_commission' => 0,     'category' => 'standard',  'sort_order' => 1],
                ['name' => 'Heart',       'coin_price' => 5,     'creator_earns' => 4,     'platform_commission' => 1,     'category' => 'standard',  'sort_order' => 2],
                ['name' => 'Handshake',   'coin_price' => 10,    'creator_earns' => 8,     'platform_commission' => 2,     'category' => 'standard',  'sort_order' => 3],
                ['name' => 'Crown',       'coin_price' => 50,    'creator_earns' => 42,    'platform_commission' => 8,     'category' => 'premium',   'sort_order' => 4],
                ['name' => 'Lion',        'coin_price' => 100,   'creator_earns' => 85,    'platform_commission' => 15,    'category' => 'premium',   'sort_order' => 5],
                ['name' => 'Rocket',      'coin_price' => 200,   'creator_earns' => 170,   'platform_commission' => 30,    'category' => 'premium',   'sort_order' => 6],
                ['name' => 'Lamborghini', 'coin_price' => 500,   'creator_earns' => 425,   'platform_commission' => 75,    'category' => 'exclusive', 'sort_order' => 7],
                ['name' => 'Diamond Ring','coin_price' => 1000,  'creator_earns' => 850,   'platform_commission' => 150,   'category' => 'exclusive', 'sort_order' => 8],
            ];

            foreach ($gifts as $gift) {
                Gift::create($gift);
            }
        }

        if (CoinPack::count() === 0) {
            $packs = [
                ['name' => 'Starter',  'coins' => 100,  'bonus_coins' => 0,   'price' => 999,   'currency' => 'NGN', 'badge' => null,       'sort_order' => 1],
                ['name' => 'Popular',  'coins' => 500,  'bonus_coins' => 50,  'price' => 4499,  'currency' => 'NGN', 'badge' => 'Popular',  'sort_order' => 2],
                ['name' => 'Pro',      'coins' => 1000, 'bonus_coins' => 150, 'price' => 7999,  'currency' => 'NGN', 'badge' => 'Best value', 'sort_order' => 3],
                ['name' => 'Legend',   'coins' => 5000, 'bonus_coins' => 1000,'price' => 34999, 'currency' => 'NGN', 'badge' => null,       'sort_order' => 4],
            ];

            foreach ($packs as $pack) {
                CoinPack::create($pack);
            }
        }
    }
}
