<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('link_in_bio_themes', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('slug')->unique();
            $table->string('description')->nullable();
            $table->boolean('is_premium')->default(false);
            $table->json('config');
            $table->integer('sort_order')->default(0);
            $table->timestamps();
        });

        DB::table('link_in_bio_themes')->insert([
            [
                'name' => 'Minimal Light',
                'slug' => 'minimal-light',
                'description' => 'Clean and simple light theme',
                'is_premium' => false,
                'sort_order' => 1,
                'config' => json_encode([
                    'bg' => '#ffffff', 'card_bg' => '#f5f5f5', 'text_color' => '#1a1a1a', 'accent' => '#2164b6',
                    'font' => 'sans', 'button_style' => 'rounded', 'layout' => 'list',
                    'background_type' => 'solid', 'background_value' => null,
                    'avatar_shape' => 'circle', 'shadow' => 'sm', 'border_radius' => '2xl',
                ]),
            ],
            [
                'name' => 'Dark Mode',
                'slug' => 'dark-mode',
                'description' => 'Sleek dark theme for night owls',
                'is_premium' => false,
                'sort_order' => 2,
                'config' => json_encode([
                    'bg' => '#0a0a0a', 'card_bg' => '#1a1a1a', 'text_color' => '#f5f5f5', 'accent' => '#38A8D8',
                    'font' => 'sans', 'button_style' => 'rounded', 'layout' => 'list',
                    'background_type' => 'solid', 'background_value' => null,
                    'avatar_shape' => 'circle', 'shadow' => 'sm', 'border_radius' => '2xl',
                ]),
            ],
            [
                'name' => 'Forest',
                'slug' => 'forest',
                'description' => 'Earthy green tones',
                'is_premium' => false,
                'sort_order' => 3,
                'config' => json_encode([
                    'bg' => '#f0f7f0', 'card_bg' => '#ffffff', 'text_color' => '#1a3a1a', 'accent' => '#2d8a4e',
                    'font' => 'serif', 'button_style' => 'pill', 'layout' => 'list',
                    'background_type' => 'solid', 'background_value' => null,
                    'avatar_shape' => 'circle', 'shadow' => 'md', 'border_radius' => 'xl',
                ]),
            ],
            [
                'name' => 'Sunset',
                'slug' => 'sunset',
                'description' => 'Warm amber-orange glow',
                'is_premium' => false,
                'sort_order' => 4,
                'config' => json_encode([
                    'bg' => '#1a0a0a', 'card_bg' => '#2a1a1a', 'text_color' => '#ffe0d0', 'accent' => '#e86a3a',
                    'font' => 'sans', 'button_style' => 'rounded', 'layout' => 'grid',
                    'background_type' => 'solid', 'background_value' => null,
                    'avatar_shape' => 'rounded', 'shadow' => 'lg', 'border_radius' => '2xl',
                ]),
            ],
            [
                'name' => 'Ocean',
                'slug' => 'ocean',
                'description' => 'Calm blue waters',
                'is_premium' => false,
                'sort_order' => 5,
                'config' => json_encode([
                    'bg' => '#f0f7ff', 'card_bg' => '#ffffff', 'text_color' => '#1a2a3a', 'accent' => '#2a6a9a',
                    'font' => 'sans', 'button_style' => 'pill', 'layout' => 'list',
                    'background_type' => 'solid', 'background_value' => null,
                    'avatar_shape' => 'circle', 'shadow' => 'sm', 'border_radius' => 'xl',
                ]),
            ],
            [
                'name' => 'Midnight',
                'slug' => 'midnight',
                'description' => 'Deep purple-dark theme',
                'is_premium' => false,
                'sort_order' => 6,
                'config' => json_encode([
                    'bg' => '#0a0a1a', 'card_bg' => '#1a1a2a', 'text_color' => '#e0e0ff', 'accent' => '#6a6aff',
                    'font' => 'mono', 'button_style' => 'sharp', 'layout' => 'list',
                    'background_type' => 'gradient', 'background_value' => 'linear-gradient(180deg, #0a0a1a 0%, #1a0a2a 100%)',
                    'avatar_shape' => 'circle', 'shadow' => 'md', 'border_radius' => 'lg',
                ]),
            ],
            [
                'name' => 'Bloom',
                'slug' => 'bloom',
                'description' => 'Soft pink floral vibes',
                'is_premium' => true,
                'sort_order' => 7,
                'config' => json_encode([
                    'bg' => '#fff5f7', 'card_bg' => '#ffffff', 'text_color' => '#4a1a2a', 'accent' => '#e84a7a',
                    'font' => 'serif', 'button_style' => 'pill', 'layout' => 'list',
                    'background_type' => 'solid', 'background_value' => null,
                    'avatar_shape' => 'circle', 'shadow' => 'md', 'border_radius' => 'xl',
                ]),
            ],
            [
                'name' => 'Cyber',
                'slug' => 'cyber',
                'description' => 'Neon-edged dark mode',
                'is_premium' => true,
                'sort_order' => 8,
                'config' => json_encode([
                    'bg' => '#0a0a0a', 'card_bg' => '#111122', 'text_color' => '#00ff88', 'accent' => '#ff00ff',
                    'font' => 'mono', 'button_style' => 'sharp', 'layout' => 'grid',
                    'background_type' => 'solid', 'background_value' => null,
                    'avatar_shape' => 'square', 'shadow' => 'lg', 'border_radius' => 'md',
                ]),
            ],
            [
                'name' => 'Cream',
                'slug' => 'cream',
                'description' => 'Warm beige minimal',
                'is_premium' => false,
                'sort_order' => 9,
                'config' => json_encode([
                    'bg' => '#faf8f0', 'card_bg' => '#ffffff', 'text_color' => '#3a3020', 'accent' => '#c4a050',
                    'font' => 'serif', 'button_style' => 'rounded', 'layout' => 'list',
                    'background_type' => 'solid', 'background_value' => null,
                    'avatar_shape' => 'circle', 'shadow' => 'sm', 'border_radius' => '2xl',
                ]),
            ],
            [
                'name' => 'Nord',
                'slug' => 'nord',
                'description' => 'Arctic blue-gray palette',
                'is_premium' => true,
                'sort_order' => 10,
                'config' => json_encode([
                    'bg' => '#2e3440', 'card_bg' => '#3b4252', 'text_color' => '#eceff4', 'accent' => '#88c0d0',
                    'font' => 'sans', 'button_style' => 'rounded', 'layout' => 'list',
                    'background_type' => 'gradient', 'background_value' => 'linear-gradient(180deg, #2e3440 0%, #3b4252 100%)',
                    'avatar_shape' => 'circle', 'shadow' => 'md', 'border_radius' => 'xl',
                ]),
            ],
            [
                'name' => 'Lavender',
                'slug' => 'lavender',
                'description' => 'Soft purple gradients',
                'is_premium' => false,
                'sort_order' => 11,
                'config' => json_encode([
                    'bg' => '#f5f0ff', 'card_bg' => '#ffffff', 'text_color' => '#2a1a4a', 'accent' => '#8a6aff',
                    'font' => 'sans', 'button_style' => 'pill', 'layout' => 'list',
                    'background_type' => 'solid', 'background_value' => null,
                    'avatar_shape' => 'rounded', 'shadow' => 'md', 'border_radius' => 'xl',
                ]),
            ],
            [
                'name' => 'Coral',
                'slug' => 'coral',
                'description' => 'Vibrant coral energy',
                'is_premium' => true,
                'sort_order' => 12,
                'config' => json_encode([
                    'bg' => '#0a0a0a', 'card_bg' => '#1a1a1a', 'text_color' => '#ffffff', 'accent' => '#ff6b5a',
                    'font' => 'sans', 'button_style' => 'sharp', 'layout' => 'grid',
                    'background_type' => 'gradient', 'background_value' => 'linear-gradient(180deg, #1a0a0a 0%, #0a0a0a 100%)',
                    'avatar_shape' => 'square', 'shadow' => 'lg', 'border_radius' => 'lg',
                ]),
            ],
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('link_in_bio_themes');
    }
};
