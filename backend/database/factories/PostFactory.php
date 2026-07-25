<?php

namespace Database\Factories;

use App\Models\Community;
use App\Models\Post;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class PostFactory extends Factory
{
    protected $model = Post::class;

    public function definition(): array
    {
        return [
            'community_id' => Community::factory(),
            'user_id' => User::factory(),
            'type' => 'post',
            'content' => fake()->paragraph(),
            'is_draft' => false,
            'likes_count' => 0,
            'comments_count' => 0,
        ];
    }
}
