<?php

namespace Database\Seeders;

use App\Models\DigitalProduct;
use App\Models\PhysicalProduct;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class MarketplaceSeeder extends Seeder
{
    public function run(): void
    {
        $vendor = User::where('role', 'vendor')->first() ?? User::where('role', 'creator')->first() ?? User::first();
        $creator = User::where('role', 'creator')->first() ?? User::where('role', 'admin')->first() ?? User::first();

        if (!$vendor && !$creator) {
            return;
        }

        $vId = $vendor->id;
        $cId = $creator->id;

        // Physical Products for Vendors
        $physicalData = [
            [
                'creator_id' => $vId,
                'title' => 'Solstar Double Door Chest Freezer 250L',
                'description' => 'Energy efficient, dual compartment, durable compressor with warranty.',
                'sku' => 'SOLSTAR-250L',
                'price' => 185000,
                'currency' => 'NGN',
                'category' => 'electronics',
                'images' => [
                    'https://images.unsplash.com/photo-1584992236310-6edddc08acff?w=800&auto=format&fit=crop',
                ],
                'stock_quantity' => 15,
                'is_active' => true,
            ],
            [
                'creator_id' => $vId,
                'title' => 'Apple MacBook Pro M3 (16GB RAM, 512GB SSD)',
                'description' => 'Space Grey, brand new sealed box with AppleCare warranty included.',
                'sku' => 'MBP-M3-16-512',
                'price' => 1650000,
                'currency' => 'NGN',
                'category' => 'electronics',
                'images' => [
                    'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=800&auto=format&fit=crop',
                ],
                'stock_quantity' => 8,
                'is_active' => true,
            ],
            [
                'creator_id' => $vId,
                'title' => 'Sony WH-1000XM5 Wireless Noise Canceling Headphones',
                'description' => 'Industry-leading noise cancellation, 30 hours battery life with quick charging.',
                'sku' => 'SONY-WH1000XM5',
                'price' => 380000,
                'currency' => 'NGN',
                'category' => 'accessories',
                'images' => [
                    'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop',
                ],
                'stock_quantity' => 20,
                'is_active' => true,
            ],
            [
                'creator_id' => $vId,
                'title' => 'MurihSpace Creator Edition Organic Cotton Hoodie',
                'description' => 'Premium heavyweight cotton hoodie with embroidered Web3 creator emblem.',
                'sku' => 'HOODIE-CREATOR-BLK',
                'price' => 45000,
                'currency' => 'NGN',
                'category' => 'clothing',
                'images' => [
                    'https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=800&auto=format&fit=crop',
                ],
                'stock_quantity' => 50,
                'is_active' => true,
            ],
            [
                'creator_id' => $vId,
                'title' => 'Minimalist Matte Ceramic Coffee Mug Set (4pcs)',
                'description' => 'Artisan handcrafted ceramic mugs for your daily studio coffee.',
                'sku' => 'MUG-CERAMIC-4SET',
                'price' => 28000,
                'currency' => 'NGN',
                'category' => 'home',
                'images' => [
                    'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=800&auto=format&fit=crop',
                ],
                'stock_quantity' => 30,
                'is_active' => true,
            ],
        ];

        foreach ($physicalData as $data) {
            PhysicalProduct::updateOrCreate(['sku' => $data['sku']], $data);
        }

        // Digital Products for Creators
        $digitalData = [
            [
                'creator_id' => $cId,
                'title' => 'Complete Web3 UI/UX Design System (Figma)',
                'slug' => 'complete-web3-design-system-figma',
                'description' => 'Over 400+ responsive components, dark/light modes, charts, tokens and auto-layout.',
                'cover_url' => 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop',
                'price' => 49.00,
                'currency' => 'USD',
                'is_free' => false,
                'status' => 'published',
                'category' => 'template',
            ],
            [
                'creator_id' => $cId,
                'title' => 'The Creator Economy Blueprint (E-Book & Worksheets)',
                'slug' => 'creator-economy-blueprint-ebook',
                'description' => 'Master audience building, brand partnerships, digital products and recurring revenue in 2026.',
                'cover_url' => 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=800&auto=format&fit=crop',
                'price' => 19.99,
                'currency' => 'USD',
                'is_free' => false,
                'status' => 'published',
                'category' => 'ebook',
            ],
            [
                'creator_id' => $cId,
                'title' => 'Cinematic Moody Lightroom & Premiere Pro LUTs Pack',
                'slug' => 'cinematic-moody-lightroom-luts',
                'description' => '15 film emulation presets for mobile and desktop photography and video grading.',
                'cover_url' => 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=800&auto=format&fit=crop',
                'price' => 29.00,
                'currency' => 'USD',
                'is_free' => false,
                'status' => 'published',
                'category' => 'graphics',
            ],
        ];

        foreach ($digitalData as $data) {
            DigitalProduct::updateOrCreate(['slug' => $data['slug']], $data);
        }
    }
}
