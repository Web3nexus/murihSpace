<?php

namespace Database\Seeders;

use App\Models\CoinPack;
use App\Models\Gift;
use Illuminate\Database\Seeder;

class GiftsAndCoinPacksSeeder extends Seeder
{
    public function run(): void
    {
        $gifts = [
            ['name' => 'Love',                 'icon_url' => '/gifts/love.png',            'coin_price' => 10,    'creator_earns' => 8,     'platform_commission' => 2,    'category' => 'standard',  'sort_order' => 1],
            ['name' => 'Legit',                'icon_url' => '/gifts/legit.png',           'coin_price' => 20,    'creator_earns' => 17,    'platform_commission' => 3,    'category' => 'standard',  'sort_order' => 2],
            ['name' => 'Legit Gold',           'icon_url' => '/gifts/legit2.png',          'coin_price' => 40,    'creator_earns' => 34,    'platform_commission' => 6,    'category' => 'standard',  'sort_order' => 3],
            ['name' => 'Wine',                 'icon_url' => '/gifts/wine.png',            'coin_price' => 25,    'creator_earns' => 21,    'platform_commission' => 4,    'category' => 'standard',  'sort_order' => 4],
            ['name' => 'Vintage Champagne',    'icon_url' => '/gifts/wine2.png',           'coin_price' => 70,    'creator_earns' => 59,    'platform_commission' => 11,   'category' => 'standard',  'sort_order' => 5],
            ['name' => 'Hookup',               'icon_url' => '/gifts/hookup.png',          'coin_price' => 30,    'creator_earns' => 25,    'platform_commission' => 5,    'category' => 'standard',  'sort_order' => 6],
            ['name' => 'Hookup Passion',       'icon_url' => '/gifts/hookup2.png',         'coin_price' => 60,    'creator_earns' => 51,    'platform_commission' => 9,    'category' => 'standard',  'sort_order' => 7],
            ['name' => 'Let\'s Hookup',        'icon_url' => '/gifts/lethookup.png',       'coin_price' => 80,    'creator_earns' => 68,    'platform_commission' => 12,   'category' => 'standard',  'sort_order' => 8],
            ['name' => 'Ankh of Life',         'icon_url' => '/gifts/ankh.png',           'coin_price' => 50,    'creator_earns' => 42,    'platform_commission' => 8,    'category' => 'standard',  'sort_order' => 9],
            ['name' => 'Party Time',           'icon_url' => '/gifts/party.png',           'coin_price' => 50,    'creator_earns' => 42,    'platform_commission' => 8,    'category' => 'standard',  'sort_order' => 10],
            ['name' => 'Hand of Fatima',       'icon_url' => '/gifts/handoffatima.png',    'coin_price' => 75,    'creator_earns' => 63,    'platform_commission' => 12,   'category' => 'standard',  'sort_order' => 11],
            ['name' => 'Aries',                'icon_url' => '/gifts/aries.png',           'coin_price' => 100,   'creator_earns' => 85,    'platform_commission' => 15,   'category' => 'standard',  'sort_order' => 12],
            ['name' => 'Taurus',               'icon_url' => '/gifts/taurus.png',          'coin_price' => 100,   'creator_earns' => 85,    'platform_commission' => 15,   'category' => 'standard',  'sort_order' => 13],
            ['name' => 'Gemini',               'icon_url' => '/gifts/gemini.png',          'coin_price' => 100,   'creator_earns' => 85,    'platform_commission' => 15,   'category' => 'standard',  'sort_order' => 14],
            ['name' => 'Cancer',               'icon_url' => '/gifts/cancer.png',          'coin_price' => 100,   'creator_earns' => 85,    'platform_commission' => 15,   'category' => 'standard',  'sort_order' => 15],
            ['name' => 'Leo',                  'icon_url' => '/gifts/leo.png',             'coin_price' => 100,   'creator_earns' => 85,    'platform_commission' => 15,   'category' => 'standard',  'sort_order' => 16],
            ['name' => 'Virgo',                'icon_url' => '/gifts/virgo.png',           'coin_price' => 100,   'creator_earns' => 85,    'platform_commission' => 15,   'category' => 'standard',  'sort_order' => 17],
            ['name' => 'Church',               'icon_url' => '/gifts/church.png',          'coin_price' => 150,   'creator_earns' => 127,   'platform_commission' => 23,   'category' => 'standard',  'sort_order' => 18],
            ['name' => 'Mosque',               'icon_url' => '/gifts/mosque.png',          'coin_price' => 150,   'creator_earns' => 127,   'platform_commission' => 23,   'category' => 'standard',  'sort_order' => 19],
            ['name' => 'Mentor',               'icon_url' => '/gifts/mentor.png',          'coin_price' => 200,   'creator_earns' => 170,   'platform_commission' => 30,   'category' => 'standard',  'sort_order' => 20],
            ['name' => 'Anpu',                 'icon_url' => '/gifts/anpu.png',            'coin_price' => 250,   'creator_earns' => 212,   'platform_commission' => 38,   'category' => 'premium',   'sort_order' => 21],
            ['name' => 'Shrine',               'icon_url' => '/gifts/shrine.png',          'coin_price' => 300,   'creator_earns' => 255,   'platform_commission' => 45,   'category' => 'premium',   'sort_order' => 22],
            ['name' => 'Golden Taurus',        'icon_url' => '/gifts/taurus2.png',         'coin_price' => 350,   'creator_earns' => 297,   'platform_commission' => 53,   'category' => 'premium',   'sort_order' => 23],
            ['name' => 'Master Key',           'icon_url' => '/gifts/master.png',          'coin_price' => 500,   'creator_earns' => 425,   'platform_commission' => 75,   'category' => 'premium',   'sort_order' => 24],
            ['name' => 'Supreme Master',       'icon_url' => '/gifts/master2.png',         'coin_price' => 1000,  'creator_earns' => 850,   'platform_commission' => 150,  'category' => 'premium',   'sort_order' => 25],
            ['name' => 'Thoth Djehuti',        'icon_url' => '/gifts/thot_djehuti.png',    'coin_price' => 1500,  'creator_earns' => 1275,  'platform_commission' => 225,  'category' => 'exclusive', 'sort_order' => 26],
            ['name' => 'Thoth Djehuti Divine', 'icon_url' => '/gifts/thot_djehuti_2.png',  'coin_price' => 3000,  'creator_earns' => 2550,  'platform_commission' => 450,  'category' => 'exclusive', 'sort_order' => 27],
            ['name' => 'King',                 'icon_url' => '/gifts/king.png',            'coin_price' => 5000,  'creator_earns' => 4250,  'platform_commission' => 750,  'category' => 'exclusive', 'sort_order' => 28],
            ['name' => 'Cruise',               'icon_url' => '/gifts/cruise.png',          'coin_price' => 7500,  'creator_earns' => 6375,  'platform_commission' => 1125, 'category' => 'exclusive', 'sort_order' => 29],
            ['name' => 'Mansion',              'icon_url' => '/gifts/mansion.png',         'coin_price' => 10000, 'creator_earns' => 8500,  'platform_commission' => 1500, 'category' => 'exclusive', 'sort_order' => 30],
        ];

        foreach ($gifts as $gift) {
            Gift::updateOrCreate(['icon_url' => $gift['icon_url']], $gift);
        }

        if (CoinPack::count() === 0) {
            $packs = [
                ['name' => 'Starter',  'coins' => 100,   'bonus_coins' => 0,     'price' => 1000,  'currency' => 'USD', 'badge' => null,         'sort_order' => 1],
                ['name' => 'Popular',  'coins' => 250,   'bonus_coins' => 15,    'price' => 2500,  'currency' => 'USD', 'badge' => 'Popular',    'sort_order' => 2],
                ['name' => 'Pro',      'coins' => 500,   'bonus_coins' => 50,    'price' => 5000,  'currency' => 'USD', 'badge' => 'Best value', 'sort_order' => 3],
                ['name' => 'Legend',   'coins' => 1000,  'bonus_coins' => 150,   'price' => 10000, 'currency' => 'USD', 'badge' => 'Legend',     'sort_order' => 4],
                ['name' => 'Royal',    'coins' => 5000,  'bonus_coins' => 1000,  'price' => 50000, 'currency' => 'USD', 'badge' => 'Royal',      'sort_order' => 5],
                ['name' => 'Elite',    'coins' => 10000, 'bonus_coins' => 2500,  'price' => 100000,'currency' => 'USD', 'badge' => 'Elite',      'sort_order' => 6],
            ];

            foreach ($packs as $pack) {
                CoinPack::create($pack);
            }
        } else {
            $packs = [
                ['name' => 'Starter',  'coins' => 100,   'bonus_coins' => 0,     'price' => 1000,  'currency' => 'USD', 'badge' => null,         'sort_order' => 1],
                ['name' => 'Popular',  'coins' => 250,   'bonus_coins' => 15,    'price' => 2500,  'currency' => 'USD', 'badge' => 'Popular',    'sort_order' => 2],
                ['name' => 'Pro',      'coins' => 500,   'bonus_coins' => 50,    'price' => 5000,  'currency' => 'USD', 'badge' => 'Best value', 'sort_order' => 3],
                ['name' => 'Legend',   'coins' => 1000,  'bonus_coins' => 150,   'price' => 10000, 'currency' => 'USD', 'badge' => 'Legend',     'sort_order' => 4],
                ['name' => 'Royal',    'coins' => 5000,  'bonus_coins' => 1000,  'price' => 50000, 'currency' => 'USD', 'badge' => 'Royal',      'sort_order' => 5],
                ['name' => 'Elite',    'coins' => 10000, 'bonus_coins' => 2500,  'price' => 100000,'currency' => 'USD', 'badge' => 'Elite',      'sort_order' => 6],
            ];

            foreach ($packs as $pack) {
                CoinPack::updateOrCreate(['name' => $pack['name']], $pack);
            }

            CoinPack::whereNotIn('id', CoinPack::whereIn('name', array_column($packs, 'name'))->pluck('id'))->delete();
        }
    }
}

