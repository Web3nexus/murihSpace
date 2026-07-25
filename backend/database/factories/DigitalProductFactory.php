<?php

namespace Database\Factories;

use App\Models\DigitalProduct;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class DigitalProductFactory extends Factory
{
    protected $model = DigitalProduct::class;

    public function definition(): array
    {
        return [
            'creator_id' => User::factory(),
            'title' => fake()->words(3, true),
            'slug' => fake()->unique()->slug(3),
            'description' => fake()->paragraph(),
            'price' => fake()->randomFloat(2, 1, 100),
            'currency' => 'USD',
            'is_free' => false,
            'category' => 'ebook',
            'status' => 'published',
            'download_count' => 0,
        ];
    }
}
