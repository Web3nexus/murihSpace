<?php

namespace Database\Factories;

use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * @extends Factory<User>
 */
class UserFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'name' => fake()->name(),
            // Ads users are keyed on murihspace_user_id. Email is not used.
            'murihspace_user_id' => fake()->unique()->numberBetween(1000, 999999),
            'password' => Hash::make(Str::random(64)),
            'remember_token' => Str::random(10),
        ];
    }
}
