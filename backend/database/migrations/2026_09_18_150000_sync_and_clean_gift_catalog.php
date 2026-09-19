<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use App\Models\Gift;

return new class extends Migration
{
    public function up(): void
    {
        $canonicalGifts = [
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

        // 1. Consolidate duplicate records sharing the same icon_url
        $allIcons = array_column($canonicalGifts, 'icon_url');
        foreach ($allIcons as $icon) {
            $existing = DB::table('gifts')->where('icon_url', $icon)->orderBy('id', 'asc')->get();
            if ($existing->count() > 1) {
                $primary = $existing->first();
                $duplicates = $existing->slice(1);
                foreach ($duplicates as $dup) {
                    DB::table('gift_transactions')->where('gift_id', $dup->id)->update(['gift_id' => $primary->id]);
                    DB::table('gifts')->where('id', $dup->id)->delete();
                }
            }
        }

        // 2. Remove obsolete dummy rows with mismatched names
        $obsoleteNames = ['Rose', 'Heart', 'Handshake', 'Lion', 'Rocket', 'Lamborghini', 'Diamond Ring', 'Crown'];
        foreach ($obsoleteNames as $name) {
            $orphans = DB::table('gifts')
                ->where('name', $name)
                ->whereNotIn('icon_url', $allIcons)
                ->get();
            foreach ($orphans as $orphan) {
                DB::table('gift_transactions')->where('gift_id', $orphan->id)->delete();
                DB::table('gifts')->where('id', $orphan->id)->delete();
            }
        }

        // 3. Upsert canonical gifts mapped cleanly to each asset
        $now = now();
        foreach ($canonicalGifts as $giftData) {
            DB::table('gifts')->updateOrInsert(
                ['icon_url' => $giftData['icon_url']],
                [
                    'name' => $giftData['name'],
                    'coin_price' => $giftData['coin_price'],
                    'creator_earns' => $giftData['creator_earns'],
                    'platform_commission' => $giftData['platform_commission'],
                    'category' => $giftData['category'],
                    'sort_order' => $giftData['sort_order'],
                    'is_active' => true,
                    'updated_at' => $now,
                ]
            );
        }
    }

    public function down(): void
    {
        // No destructive reversal needed
    }
};

