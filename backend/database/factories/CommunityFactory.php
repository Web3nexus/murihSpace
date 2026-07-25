<?php

namespace Database\Factories;

use App\Models\Community;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class CommunityFactory extends Factory
{
    protected $model = Community::class;

    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'name' => fake()->company(),
            'slug' => fake()->unique()->slug(2),
            'description' => fake()->sentence(),
            'category' => fake()->randomElement(['Technology', 'Art', 'Music', 'Education']),
            'visibility' => 'public',
            'pricing_type' => 'free',
            'members_count' => 1,
            'rules' => ['Be respectful.'],
        ];
    }
}
