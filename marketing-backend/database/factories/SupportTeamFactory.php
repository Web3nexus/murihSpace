<?php

namespace Database\Factories;

use App\Models\SupportTeam;
use Illuminate\Database\Eloquent\Factories\Factory;

class SupportTeamFactory extends Factory
{
    protected $model = SupportTeam::class;

    public function definition(): array
    {
        return [
            'name' => $this->faker->unique()->company(),
            'description' => $this->faker->sentence(),
            'is_active' => true,
            'sort_order' => 0,
        ];
    }

    public function disabled(): static
    {
        return $this->state(fn () => ['is_active' => false]);
    }
}
